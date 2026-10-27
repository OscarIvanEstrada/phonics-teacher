/**
 * Where each generated audio lives in the public GitHub repo (folder audio/ on main).
 * Shared by the browser, the iOS app (readers) and server.ts (writer), so all compute the same path.
 *
 *   audio/<engine>/<voice>/words/<word>[.slow][.breakdown].wav   single words: readable names
 *   audio/<engine>/<voice>/text/<slug>-<hash>.wav               sentences
 *   audio/<engine>/<voice>/sounds/<hash>.wav                    isolated phonics sounds (IPA)
 */

export const AUDIO_REPO = 'OscarIvanEstrada/phonics-teacher';
export const AUDIO_BRANCH = 'main';
export const AUDIO_RAW_BASE = `https://raw.githubusercontent.com/${AUDIO_REPO}/${AUDIO_BRANCH}/`;
export const AUDIO_TREE_URL = `https://api.github.com/repos/${AUDIO_REPO}/git/trees/${AUDIO_BRANCH}?recursive=1`;

/** FNV-1a 32-bit: tiny, deterministic, same result in Node and the browser. */
export function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export interface AudioPathInput {
  engine: string;
  voice: string;
  text: string;
  /** IPA of an isolated sound; when present the path is a sound, not a word */
  ipa?: string;
  slow?: boolean;
  breakdown?: boolean;
}

export function audioPath({ engine, voice, text, ipa, slow, breakdown }: AudioPathInput): string {
  const base = `audio/${engine}/${voice.toLowerCase()}`;
  if (ipa) return `${base}/sounds/${hash(ipa)}.wav`;
  const clean = text.trim().toLowerCase();
  const variant = `${slow ? '.slow' : ''}${breakdown ? '.breakdown' : ''}`;
  if (/^[a-z][a-z-]*$/.test(clean)) return `${base}/words/${clean}${variant}.wav`;
  return `${base}/text/${slugify(clean)}-${hash(clean + variant)}${variant}.wav`;
}

/** "audio/kokoro/puck/words/cat.wav" → { voice: "Puck", word: "cat" } for plain word audio, else null. */
export function wordFromPath(path: string): { engine: string; voice: string; word: string } | null {
  const m = /^audio\/([^/]+)\/([^/]+)\/words\/([a-z-]+)\.wav$/.exec(path);
  if (!m) return null;
  return { engine: m[1], voice: m[2][0].toUpperCase() + m[2].slice(1), word: m[3] };
}
