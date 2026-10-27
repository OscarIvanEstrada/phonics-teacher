/**
 * How a phonics teacher says each sound in isolation.
 * - `ipa`: standard IPA for engines that read phonemes (Kokoro, iOS AVSpeechSynthesizer).
 *   Vowels and continuants are held (ː); stops get only a light release (ᵊ), never a full "uh".
 * - `spoken`: plain-text spelling for engines that only read text (Chatterbox).
 */
export interface PhonemeSound {
  symbol: string; // as written in the curriculum, e.g. "æ"
  ipa: string;
  spoken: string;
}

const SOUNDS: Record<string, { ipa: string; spoken: string }> = {
  // Short vowels
  æ: { ipa: 'ˈæː', spoken: 'aah' },
  ɛ: { ipa: 'ˈɛː', spoken: 'ehh' },
  ɪ: { ipa: 'ˈɪː', spoken: 'ihh' },
  ɒ: { ipa: 'ˈɑː', spoken: 'ahh' },
  ʌ: { ipa: 'ˈʌː', spoken: 'uhh' },
  ʊ: { ipa: 'ˈʊː', spoken: 'ooh' },
  // Long vowels, diphthongs and r-controlled
  iː: { ipa: 'ˈiː', spoken: 'eee' },
  uː: { ipa: 'ˈuː', spoken: 'ooo' },
  ɔː: { ipa: 'ˈɔː', spoken: 'aww' },
  eɪ: { ipa: 'ˈeɪ', spoken: 'ay' },
  aɪ: { ipa: 'ˈaɪ', spoken: 'eye' },
  oʊ: { ipa: 'ˈoʊ', spoken: 'oh' },
  aʊ: { ipa: 'ˈaʊ', spoken: 'ow' },
  ɔɪ: { ipa: 'ˈɔɪ', spoken: 'oy' },
  ɑːr: { ipa: 'ˈɑːɹ', spoken: 'ar' },
  ɔːr: { ipa: 'ˈɔːɹ', spoken: 'or' },
  ɛr: { ipa: 'ˈɛɹ', spoken: 'air' },
  ɪr: { ipa: 'ˈɪɹ', spoken: 'ear' },
  ʊr: { ipa: 'ˈʊɹ', spoken: 'oor' },
  ɜːr: { ipa: 'ˈɜːɹ', spoken: 'er' },
  ər: { ipa: 'ɚ', spoken: 'er' },
  ə: { ipa: 'ə', spoken: 'uh' },
  // Continuants: can be held
  s: { ipa: 'sː', spoken: 'sss' },
  z: { ipa: 'zː', spoken: 'zzz' },
  f: { ipa: 'fː', spoken: 'fff' },
  v: { ipa: 'vː', spoken: 'vvv' },
  m: { ipa: 'mː', spoken: 'mmm' },
  n: { ipa: 'nː', spoken: 'nnn' },
  l: { ipa: 'lː', spoken: 'lll' },
  r: { ipa: 'ɹː', spoken: 'rrr' },
  ŋ: { ipa: 'ŋː', spoken: 'ng' },
  ʃ: { ipa: 'ʃː', spoken: 'shhh' },
  ʒ: { ipa: 'ʒː', spoken: 'zhh' },
  θ: { ipa: 'θː', spoken: 'thhh' },
  ð: { ipa: 'ðː', spoken: 'thh' },
  // Stops and glides: clipped, with only a light release
  p: { ipa: 'pᵊ', spoken: 'p' },
  b: { ipa: 'bᵊ', spoken: 'buh' },
  t: { ipa: 'tᵊ', spoken: 't' },
  d: { ipa: 'dᵊ', spoken: 'duh' },
  k: { ipa: 'kᵊ', spoken: 'k' },
  g: { ipa: 'ɡᵊ', spoken: 'guh' },
  tʃ: { ipa: 'tʃᵊ', spoken: 'ch' },
  dʒ: { ipa: 'dʒᵊ', spoken: 'juh' },
  h: { ipa: 'hᵊ', spoken: 'hh' },
  w: { ipa: 'wᵊ', spoken: 'wuh' },
  j: { ipa: 'jᵊ', spoken: 'yuh' },
};

/** Parse a curriculum transcription like "/k/ /æ/ /t/" into the sounds a teacher would say. */
export function parsePhonetics(phonetics: string): PhonemeSound[] {
  return (phonetics.match(/\/([^/]+)\//g) || [])
    .map((token) => token.replace(/\//g, '').trim())
    .filter(Boolean)
    .map((symbol) => {
      const known = SOUNDS[symbol] ?? SOUNDS[symbol.replace('ɡ', 'g').replace('ɹ', 'r')];
      return { symbol, ipa: known?.ipa ?? symbol, spoken: known?.spoken ?? symbol };
    });
}

const VOWELS = new Set(['æ', 'ɛ', 'ɪ', 'ɒ', 'ʌ', 'ʊ', 'ə', 'iː', 'uː', 'ɔː', 'eɪ', 'aɪ', 'oʊ', 'aʊ', 'ɔɪ', 'ɑːr', 'ɔːr', 'ɛr', 'ɪr', 'ʊr', 'ɜːr', 'ər']);

/** Standard IPA for a symbol inside a blended chunk (no lengthening/release). */
function blendIpa(symbol: string): string {
  if (symbol === 'r') return 'ɹ';
  if (symbol === 'g') return 'ɡ';
  if (symbol === 'ɒ') return 'ɑ';
  return symbol.replace(/r$/, 'ɹ');
}

/** All symbols, longest first, to split an unspaced chunk like "æt" or "kw". */
const SYMBOLS_BY_LENGTH = Object.keys(SOUNDS).sort((a, b) => b.length - a.length);

function tokenize(chunk: string): string[] {
  const tokens: string[] = [];
  let rest = chunk;
  while (rest.length > 0) {
    const symbol = SYMBOLS_BY_LENGTH.find((sym) => rest.startsWith(sym)) ?? rest[0];
    tokens.push(symbol);
    rest = rest.slice(symbol.length);
  }
  return tokens;
}

/**
 * The sound a sort header teaches: "/b/" (one phoneme), "/sp/" (a blend) or "/æt/" (a rime).
 * Blends hold their last consonant; rimes are said as one blended chunk.
 */
export function headerSound(sound: string, label: string): PhonemeSound {
  const chunk = sound.replace(/\//g, '').trim();
  const known = SOUNDS[chunk];
  if (known) return { symbol: chunk, ...known };
  const tokens = tokenize(chunk);
  if (tokens.some((t) => VOWELS.has(t))) {
    return { symbol: chunk, ipa: `ˈ${tokens.map(blendIpa).join('')}`, spoken: label.replace('-', '') };
  }
  const last = tokens[tokens.length - 1];
  return {
    symbol: chunk,
    ipa: tokens.slice(0, -1).map(blendIpa).join('') + (SOUNDS[last]?.ipa ?? last),
    spoken: tokens.map((t) => SOUNDS[t]?.spoken ?? t).join(''),
  };
}

/**
 * Split a word's sounds into onset (consonants before the first vowel) and rime.
 * The rime is returned as one blended sound ("-an" → /æn/), the way it is taught.
 */
export function splitOnsetRime(phonetics: string, rimeText: string): { onset: PhonemeSound[]; rime: PhonemeSound | null } {
  const sounds = parsePhonetics(phonetics);
  const firstVowel = sounds.findIndex((s) => VOWELS.has(s.symbol));
  if (firstVowel < 0) return { onset: sounds, rime: null };
  const rimeSounds = sounds.slice(firstVowel);
  return {
    onset: sounds.slice(0, firstVowel),
    rime: {
      symbol: rimeSounds.map((s) => s.symbol).join(''),
      ipa: `ˈ${rimeSounds.map((s) => blendIpa(s.symbol)).join('')}`,
      spoken: rimeText.replace('-', '') || rimeSounds.map((s) => s.spoken).join(''),
    },
  };
}
