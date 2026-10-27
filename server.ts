import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { AUDIO_BRANCH, AUDIO_REPO, audioPath } from './src/services/audioPaths';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// AI Studio dev server must run strictly on port 3000
const PORT = 3000;

app.use(express.json());

// Initialize Gemini Client (key from .env / environment only — never hardcode it)
const apiKey = process.env.GEMINI_API_KEY;

const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;


// Local TTS sidecars (vector/tts-engine), one process per engine
type TtsEngine = 'vibevoice' | 'kokoro' | 'chatterbox';
const TTS_ENGINES: Record<TtsEngine, { url: string; lang: string; voices: Record<string, string> }> = {
  vibevoice: {
    url: process.env.TTS_VIBEVOICE_URL || 'http://127.0.0.1:8771',
    lang: 'en',
    voices: { Kore: 'en-emma_woman', Zephyr: 'en-grace_woman', Puck: 'en-carter_man' },
  },
  kokoro: {
    url: process.env.TTS_KOKORO_URL || 'http://127.0.0.1:8772',
    lang: 'en-us',
    voices: { Kore: 'af_bella', Zephyr: 'af_heart', Puck: 'am_michael' },
  },
  // Chatterbox Turbo clones the reference WAVs in tts-engine/voices/chatterbox/<voice>.wav
  chatterbox: {
    url: process.env.TTS_CHATTERBOX_URL || 'http://127.0.0.1:8773',
    lang: 'en',
    voices: { Kore: 'kore', Zephyr: 'zephyr', Puck: 'puck' },
  },
};

// ==========================================
// Audio publishing: every generated WAV is committed to the public repo's `audio` branch,
// where the web and iOS apps read it (see src/services/audioPaths.ts).
// ==========================================
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_API = `https://api.github.com/repos/${AUDIO_REPO}`;

async function github(pathname: string, init: RequestInit = {}) {
  return fetch(`${GITHUB_API}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {}),
    },
  });
}

let audioBranchReady: Promise<void> | null = null;

/** Create the `audio` branch from main the first time (an orphan-like branch would need the Git Data API). */
function ensureAudioBranch(): Promise<void> {
  if (!audioBranchReady) {
    audioBranchReady = (async () => {
      const existing = await github(`/git/ref/heads/${AUDIO_BRANCH}`);
      if (existing.ok) return;
      const main = await github('/git/ref/heads/main');
      if (!main.ok) throw new Error(`Cannot read main branch: ${main.status}`);
      const { object } = await main.json();
      const created = await github('/git/refs', {
        method: 'POST',
        body: JSON.stringify({ ref: `refs/heads/${AUDIO_BRANCH}`, sha: object.sha }),
      });
      if (!created.ok && created.status !== 422) throw new Error(`Cannot create ${AUDIO_BRANCH} branch: ${created.status}`);
    })().catch((err) => {
      audioBranchReady = null;
      throw err;
    });
  }
  return audioBranchReady;
}

// Commits to one branch must be sequential, or GitHub rejects them with 409 conflicts
let publishQueue: Promise<unknown> = Promise.resolve();

function publishAudio(filePath: string, audioBase64: string, message: string): Promise<boolean> {
  if (!GITHUB_TOKEN) return Promise.resolve(false);
  const task = publishQueue.then(async () => {
    await ensureAudioBranch();
    const current = await github(`/contents/${filePath}?ref=${AUDIO_BRANCH}`);
    const sha = current.ok ? (await current.json()).sha : undefined;
    const res = await github(`/contents/${filePath}`, {
      method: 'PUT',
      body: JSON.stringify({ message, content: audioBase64, branch: AUDIO_BRANCH, ...(sha ? { sha } : {}) }),
    });
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return true;
  });
  publishQueue = task.catch(() => {});
  return task.catch((err) => {
    console.warn('Audio publish to GitHub failed:', filePath, err.message);
    return false;
  });
}

let lastTtsStatus: 'working' | 'unavailable' | 'unknown' = 'unknown';
let lastTtsError: string | null = null;

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(apiKey),
    audioPublishing: GITHUB_TOKEN ? `github:${AUDIO_REPO}@${AUDIO_BRANCH}` : 'disabled (set GITHUB_TOKEN)',
    ttsEngines: Object.fromEntries(Object.entries(TTS_ENGINES).map(([k, v]) => [k, v.url])),
    ttsStatus: lastTtsStatus,
    ttsError: lastTtsError,
    timestamp: new Date().toISOString(),
  });
});

// Text-to-Speech Endpoint: synthesize with the selected sidecar, then publish to GitHub
app.post('/api/tts', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, voiceName = 'Kore', style, regenerate = false, ipa, slow = false, breakdown = false } = req.body;
    const engine: TtsEngine = req.body.engine in TTS_ENGINES ? req.body.engine : 'vibevoice';
    const engineCfg = TTS_ENGINES[engine];

    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text parameter is required' });
      return;
    }

    // Isolated phonics sounds: Kokoro reads the IPA itself; other engines read the teacher's spelling in `text`
    const usePhonemes = typeof ipa === 'string' && ipa.length > 0 && engine === 'kokoro';
    const filePath = audioPath({ engine, voice: voiceName, text, ipa, slow, breakdown });

    // Readers check GitHub before calling here, so this always synthesizes (also on regenerate)
    const engineVoice = engineCfg.voices[voiceName] || voiceName.toLowerCase();
    const ttsRes = await fetch(`${engineCfg.url}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        ...(usePhonemes ? { phonemes: ipa } : {}),
        voice: engineVoice,
        lang: engineCfg.lang,
        speed: slow || (style && /slow/i.test(style)) ? 0.8 : 1.0,
      }),
    });

    if (!ttsRes.ok) {
      throw new Error(`${engine} TTS error ${ttsRes.status}: ${await ttsRes.text()}`);
    }

    const base64Audio = Buffer.from(await ttsRes.arrayBuffer()).toString('base64');

    if (!base64Audio) {
      res.status(500).json({ error: `No audio data received from ${engine} TTS` });
      return;
    }

    // Publish in the background: the child hears the audio now, the commit follows
    void publishAudio(filePath, base64Audio, `${regenerate ? 'regenerate' : 'add'} ${filePath} (${engine}, ${voiceName})`);

    lastTtsStatus = 'working';
    lastTtsError = null;

    res.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      word: text,
      fromCache: false,
      source: engine,
      path: filePath,
      published: Boolean(GITHUB_TOKEN),
    });
  } catch (error: any) {
    lastTtsStatus = 'unavailable';
    lastTtsError = `Fallo del motor TTS: ${error.message}`;
    console.error('TTS error:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate speech audio',
      ttsStatus: lastTtsStatus,
      ttsError: lastTtsError,
      fallback: true,
    });
  }
});

// AI New Words Generator (with exclusion list to prevent repeating)
app.post('/api/generate-words', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      familyId,
      pattern,
      familyTitle,
      excludeWords = [],
      count = 5,
    } = req.body;

    if (!pattern) {
      res.status(400).json({ error: 'Pattern is required (e.g. -at, -in, -ake)' });
      return;
    }

    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured on the server',
      });
      return;
    }

    const excludeListStr = (excludeWords as string[])
      .map((w: string) => w.toLowerCase().trim())
      .filter(Boolean)
      .slice(-60)
      .join(', ');

    const prompt = `You are Professor Spark, an expert and loving elementary school teacher teaching English phonics to children aged 7-11.
Target Word Family: "${familyTitle || pattern}" (phonetic rime ending: "${pattern}").

CRITICAL REQUIREMENT:
The child has ALREADY practiced and stored these words in their classroom memory (IndexedDB):
[${excludeListStr || 'none yet'}]

You MUST NOT generate any of the words listed above! Provide brand new, real, age-appropriate, kid-friendly English words that end with or rhyme with "${pattern}".
Generate ${count} distinct new words.

For each word:
- word: lowercase English word
- onset: initial letter(s) or consonant blend (e.g. "c", "fl", "st", "b")
- rime: ending pattern (e.g. "${pattern}")
- phonetics: kid-friendly phonetic sound breakdown, e.g. "/k/ /æ/ /t/"
- meaningEs: friendly Spanish translation (1-3 words)
- exampleSentence: short, fun, easy sentence in English for a child to read
- exampleSentenceEs: Spanish translation of the sentence
- emoji: single fun emoji representing the object or action`;

    let response;
    const generateConfig = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            onset: { type: Type.STRING },
            rime: { type: Type.STRING },
            phonetics: { type: Type.STRING },
            meaningEs: { type: Type.STRING },
            exampleSentence: { type: Type.STRING },
            exampleSentenceEs: { type: Type.STRING },
            emoji: { type: Type.STRING },
          },
          required: [
            'word',
            'onset',
            'rime',
            'phonetics',
            'meaningEs',
            'exampleSentence',
            'exampleSentenceEs',
            'emoji',
          ],
        },
      },
    };

    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: generateConfig,
      });
    } catch (modelErr: any) {
      console.warn('gemini-3.8-flash busy/error, trying gemini-2.5-flash:', modelErr.message);
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: generateConfig,
      });
    }

    const text = response.text || '[]';
    const parsed = JSON.parse(text);

    res.json({
      success: true,
      familyId,
      pattern,
      words: parsed,
    });
  } catch (error: any) {
    console.error('Word generation error, using fallback bank:', error.message);

    // Fallback bank for common families so the child can always practice and test IndexedDB!
    const fallbackBank: Record<string, Array<{ word: string; onset: string; rime: string; phonetics: string; meaningEs: string; exampleSentence: string; exampleSentenceEs: string; emoji: string }>> = {
      '-at': [
        { word: 'flat', onset: 'fl', rime: '-at', phonetics: '/f/ /l/ /æ/ /t/', meaningEs: 'plano / liso', exampleSentence: 'The pancake is flat and round.', exampleSentenceEs: 'El panqueque es plano y redondo.', emoji: '🥞' },
        { word: 'chat', onset: 'ch', rime: '-at', phonetics: '/tʃ/ /æ/ /t/', meaningEs: 'charlar / platicar', exampleSentence: 'Let us chat with our friend.', exampleSentenceEs: 'Vamos a charlar con nuestro amigo.', emoji: '💬' },
        { word: 'brat', onset: 'br', rime: '-at', phonetics: '/b/ /r/ /æ/ /t/', meaningEs: 'travieso', exampleSentence: 'Do not be a silly brat.', exampleSentenceEs: 'No seas un travieso.', emoji: '😜' },
        { word: 'spat', onset: 'sp', rime: '-at', phonetics: '/s/ /p/ /æ/ /t/', meaningEs: 'escupió / discusión', exampleSentence: 'The cat spat in surprise.', exampleSentenceEs: 'El gato bufó con sorpresa.', emoji: '😼' },
      ],
      '-an': [
        { word: 'plan', onset: 'pl', rime: '-an', phonetics: '/p/ /l/ /æ/ /n/', meaningEs: 'plan / proyecto', exampleSentence: 'We have a great secret plan.', exampleSentenceEs: 'Tenemos un gran plan secreto.', emoji: '📋' },
        { word: 'scan', onset: 'sc', rime: '-an', phonetics: '/s/ /k/ /æ/ /n/', meaningEs: 'escanear / mirar', exampleSentence: 'Scan the sky for flying birds.', exampleSentenceEs: 'Examina el cielo buscando aves.', emoji: '🔍' },
        { word: 'span', onset: 'sp', rime: '-an', phonetics: '/s/ /p/ /æ/ /n/', meaningEs: 'abarcar / puente', exampleSentence: 'Bridges span across the river.', exampleSentenceEs: 'Los puentes cruzan el río.', emoji: '🌉' },
        { word: 'clan', onset: 'cl', rime: '-an', phonetics: '/k/ /l/ /æ/ /n/', meaningEs: 'clan / tribu', exampleSentence: 'Our family clan eats together.', exampleSentenceEs: 'Nuestro clan familiar come junto.', emoji: '👨‍👩‍👧‍👦' },
      ],
      '-in': [
        { word: 'chin', onset: 'ch', rime: '-in', phonetics: '/tʃ/ /ɪ/ /n/', meaningEs: 'barbilla / mentón', exampleSentence: 'Touch your chin with your finger.', exampleSentenceEs: 'Toca tu barbilla con tu dedo.', emoji: '🧔' },
        { word: 'spin', onset: 'sp', rime: '-in', phonetics: '/s/ /p/ /ɪ/ /n/', meaningEs: 'girar / dar vueltas', exampleSentence: 'Watch the toy pinwheel spin.', exampleSentenceEs: 'Mira girar el molinillo de viento.', emoji: '🎡' },
        { word: 'twin', onset: 'tw', rime: '-in', phonetics: '/t/ /w/ /ɪ/ /n/', meaningEs: 'gemelo / mellizo', exampleSentence: 'The twin brothers look alike.', exampleSentenceEs: 'Los hermanos gemelos se parecen.', emoji: '👯' },
        { word: 'skin', onset: 'sk', rime: '-in', phonetics: '/s/ /k/ /ɪ/ /n/', meaningEs: 'piel', exampleSentence: 'Wash your skin with mild soap.', exampleSentenceEs: 'Lava tu piel con jabón suave.', emoji: '🧼' },
        { word: 'shin', onset: 'sh', rime: '-in', phonetics: '/ʃ/ /ɪ/ /n/', meaningEs: 'espinilla', exampleSentence: 'Wear guards to protect your shin.', exampleSentenceEs: 'Usa espinilleras para protegerte.', emoji: '🦵' },
      ],
      '-en': [
        { word: 'glen', onset: 'gl', rime: '-en', phonetics: '/g/ /l/ /ɛ/ /n/', meaningEs: 'cañada / valle', exampleSentence: 'Flowers grow in the green glen.', exampleSentenceEs: 'Las flores crecen en la cañada verde.', emoji: '🏞️' },
        { word: 'then', onset: 'th', rime: '-en', phonetics: '/ð/ /ɛ/ /n/', meaningEs: 'entonces / luego', exampleSentence: 'We played, then we ate lunch.', exampleSentenceEs: 'Jugamos, luego almorzamos.', emoji: '⏰' },
        { word: 'when', onset: 'wh', rime: '-en', phonetics: '/w/ /ɛ/ /n/', meaningEs: 'cuándo', exampleSentence: 'When will the school bell ring?', exampleSentenceEs: '¿Cuándo sonará la campana?', emoji: '🔔' },
      ],
      '-un': [
        { word: 'spun', onset: 'sp', rime: '-un', phonetics: '/s/ /p/ /ʌ/ /n/', meaningEs: 'giró / hiló', exampleSentence: 'The spider spun a silky web.', exampleSentenceEs: 'La araña hiló una telaraña de seda.', emoji: '🕸️' },
        { word: 'stun', onset: 'st', rime: '-un', phonetics: '/s/ /t/ /ʌ/ /n/', meaningEs: 'asombrar', exampleSentence: 'The magic trick will stun the class.', exampleSentenceEs: 'El truco de magia asombrará a la clase.', emoji: '✨' },
        { word: 'shun', onset: 'sh', rime: '-un', phonetics: '/ʃ/ /ʌ/ /n/', meaningEs: 'evitar', exampleSentence: 'Wise students shun bad habits.', exampleSentenceEs: 'Los sabios evitan los malos hábitos.', emoji: '🛡️' },
      ],
      '-ing': [
        { word: 'wing', onset: 'w', rime: '-ing', phonetics: '/w/ /ɪ/ /ŋ/', meaningEs: 'ala', exampleSentence: 'The eagle spread its mighty wings.', exampleSentenceEs: 'El águila extendió sus alas poderosas.', emoji: '🪶' },
        { word: 'sting', onset: 'st', rime: '-ing', phonetics: '/s/ /t/ /ɪ/ /ŋ/', meaningEs: 'picar / aguijón', exampleSentence: 'Do not let the bee sting you.', exampleSentenceEs: 'No dejes que la abeja te pique.', emoji: '🐝' },
        { word: 'swing', onset: 'sw', rime: '-ing', phonetics: '/s/ /w/ /ɪ/ /ŋ/', meaningEs: 'columpio / columpiarse', exampleSentence: 'Swing high at the playground.', exampleSentenceEs: 'Colúmpiate alto en el parque.', emoji: '🛝' },
        { word: 'cling', onset: 'cl', rime: '-ing', phonetics: '/k/ /l/ /ɪ/ /ŋ/', meaningEs: 'aferrarse', exampleSentence: 'Koalas cling to eucalyptus trees.', exampleSentenceEs: 'Los koalas se aferran a los eucaliptos.', emoji: '🐨' },
      ],
      '-ight': [
        { word: 'bright', onset: 'br', rime: '-ight', phonetics: '/b/ /r/ /aɪ/ /t/', meaningEs: 'brillante', exampleSentence: 'The sun is sunny and bright.', exampleSentenceEs: 'El sol es radiante y brillante.', emoji: '☀️' },
        { word: 'flight', onset: 'fl', rime: '-ight', phonetics: '/f/ /l/ /aɪ/ /t/', meaningEs: 'vuelo', exampleSentence: 'The airplane took off for its flight.', exampleSentenceEs: 'El avión despegó para su vuelo.', emoji: '✈️' },
        { word: 'tight', onset: 't', rime: '-ight', phonetics: '/t/ /aɪ/ /t/', meaningEs: 'apretado', exampleSentence: 'Tie your shoelaces tight.', exampleSentenceEs: 'Ata tus agujetas bien apretadas.', emoji: '👟' },
        { word: 'knight', onset: 'kn', rime: '-ight', phonetics: '/n/ /aɪ/ /t/', meaningEs: 'caballero', exampleSentence: 'The brave knight had shiny armor.', exampleSentenceEs: 'El caballero valiente tenía armadura.', emoji: '🛡️' },
      ],
    };

    const targetPattern = (req.body.pattern || '').toLowerCase().trim();
    const candidateList = fallbackBank[targetPattern] || [
      { word: `sp${targetPattern.replace('-', '')}`, onset: 'sp', rime: targetPattern, phonetics: `/${targetPattern}/`, meaningEs: 'palabra nueva', exampleSentence: 'Look at the new word!', exampleSentenceEs: '¡Mira la nueva palabra!', emoji: '⭐' },
      { word: `fl${targetPattern.replace('-', '')}`, onset: 'fl', rime: targetPattern, phonetics: `/${targetPattern}/`, meaningEs: 'palabra rimada', exampleSentence: 'Practice this rhyming word.', exampleSentenceEs: 'Practica esta palabra rimada.', emoji: '🌟' },
      { word: `tr${targetPattern.replace('-', '')}`, onset: 'tr', rime: targetPattern, phonetics: `/${targetPattern}/`, meaningEs: 'sonido fonético', exampleSentence: 'Read and sound it out.', exampleSentenceEs: 'Léela y pronúnciala.', emoji: '📖' },
    ];

    const excludeSet = new Set((req.body.excludeWords || []).map((w: string) => w.toLowerCase().trim()));
    const filtered = candidateList.filter((item) => !excludeSet.has(item.word.toLowerCase()));

    res.json({
      success: true,
      familyId: req.body.familyId,
      pattern: req.body.pattern,
      words: filtered.length > 0 ? filtered : candidateList,
    });
  }
});

// Mount Vite or static server
async function setupServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Teacher Phonics Server running on http://0.0.0.0:${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
