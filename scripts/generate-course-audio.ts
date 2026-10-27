/**
 * Pre-generate every audio the course needs, written to ./audio/ so it can be committed in one go.
 *
 *   npx tsx scripts/generate-course-audio.ts [engine=kokoro] [voices=Kore,Puck,Zephyr]
 *
 * Needs the dev server (npm run dev) and the engine's sidecar running. Uses the server's own
 * /api/tts with `publish: false`, so files are byte-identical to what the app would generate,
 * at the same paths the app reads (src/services/audioPaths.ts). Existing files are skipped.
 */
import fs from 'fs';
import path from 'path';
import { ALL_SORTS, courseWords } from '../src/data/course';
import { WORD_BANK } from '../src/data/wordBank';
import { PHONICS_GROUPS } from '../src/data/phonicsCurriculum';
import { BLACKBOARD_GROUPS } from '../src/data/blackboardGroups';
import { headerSound, parsePhonetics, splitOnsetRime, PhonemeSound } from '../src/services/phonemes';
import { audioPath } from '../src/services/audioPaths';

const SERVER = process.env.APP_URL_LOCAL || 'http://localhost:3000';
const engine = process.argv[2] || 'kokoro';
const voices = (process.argv[3] || 'Kore,Puck,Zephyr').split(',');
const root = path.resolve(import.meta.dirname, '..');

// Words: course words + original curriculum words (both appear on the Pizarra)
const words = new Set<string>([...courseWords(), ...PHONICS_GROUPS.flatMap((g) => g.families.flatMap((f) => f.words.map((w) => w.word)))]);

// Sounds: every phoneme of every word, every sort header, every onset/rime on the Pizarra
const sounds = new Map<string, PhonemeSound>();
const addSound = (s: PhonemeSound | null) => s && sounds.set(s.ipa, s);
for (const [ipa] of Object.values(WORD_BANK)) {
  parsePhonetics(ipa.split(' ').map((p) => `/${p}/`).join(' ')).forEach(addSound);
}
for (const sort of ALL_SORTS) sort.categories.filter((c) => c.sound).forEach((c) => addSound(headerSound(c.sound, c.label)));
for (const word of BLACKBOARD_GROUPS.flatMap((g) => g.families.flatMap((f) => f.words))) {
  parsePhonetics(word.phonetics).forEach(addSound);
  const { onset, rime } = splitOnsetRime(word.phonetics, word.rime);
  onset.forEach(addSound);
  addSound(rime);
}

type Job = { text: string; ipa?: string; voice: string };
const jobs: Job[] = voices.flatMap((voice) => [
  ...[...words].map((text) => ({ text, voice })),
  ...[...sounds.values()].map((s) => ({ text: s.spoken, ipa: s.ipa, voice })),
]);

async function run() {
  let made = 0;
  let skipped = 0;
  const failed: string[] = [];
  for (const [i, job] of jobs.entries()) {
    const file = path.join(root, audioPath({ engine, voice: job.voice, text: job.text, ipa: job.ipa }));
    if (fs.existsSync(file)) {
      skipped++;
      continue;
    }
    const res = await fetch(`${SERVER}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: job.text, ipa: job.ipa, voiceName: job.voice, engine, publish: false }),
    });
    const data = res.ok ? await res.json() : null;
    if (!data?.audioBase64) {
      failed.push(`${job.voice}:${job.ipa ?? job.text}`);
      continue;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(data.audioBase64, 'base64'));
    made++;
    if ((i + 1) % 100 === 0) console.log(`${i + 1}/${jobs.length}`);
  }
  console.log(`engine=${engine} voices=${voices.join(',')} words=${words.size} sounds=${sounds.size}`);
  console.log(`generated=${made} skipped=${skipped} failed=${failed.length}${failed.length ? ` → ${failed.slice(0, 10).join(' ')}` : ''}`);
}

run();
