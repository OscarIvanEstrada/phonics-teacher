import { AUDIO_RAW_BASE, AUDIO_TREE_URL } from './audioPaths';

/**
 * Audio published in the public GitHub repo (branch `audio`).
 * The file list is fetched once per session (one GitHub API call); files are then read from
 * raw.githubusercontent.com only when listed, so there are no blind 404 requests.
 */

type Listener = (paths: Set<string>) => void;

let manifest: Promise<Set<string>> | null = null;
const published = new Set<string>();
const listeners = new Set<Listener>();
// Audio generated in this session: raw.githubusercontent.com may serve the previous version for a few minutes
const fresh = new Map<string, string>();

function notify() {
  listeners.forEach((l) => l(published));
}

export function loadPublishedAudio(): Promise<Set<string>> {
  if (!manifest) {
    manifest = fetch(AUDIO_TREE_URL, { headers: { Accept: 'application/vnd.github+json' } })
      .then((res) => (res.ok ? res.json() : { tree: [] }))
      .then((data: { tree?: Array<{ path: string; type: string }> }) => {
        for (const entry of data.tree ?? []) {
          if (entry.type === 'blob' && entry.path.endsWith('.wav')) published.add(entry.path);
        }
        notify();
        return published;
      })
      .catch((err) => {
        console.warn('Could not load published audio list from GitHub:', err);
        return published;
      });
  }
  return manifest;
}

export function subscribePublishedAudio(listener: Listener): () => void {
  listeners.add(listener);
  listener(published);
  return () => listeners.delete(listener);
}

export async function isPublished(path: string): Promise<boolean> {
  await loadPublishedAudio();
  return published.has(path) || fresh.has(path);
}

/** Download a published audio as base64 WAV (or the fresh copy generated in this session). */
export async function readPublishedAudio(path: string): Promise<string | null> {
  const local = fresh.get(path);
  if (local) return local;
  try {
    const res = await fetch(AUDIO_RAW_BASE + path);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  } catch (err) {
    console.warn('Could not read published audio:', path, err);
    return null;
  }
}

/** Record audio the server just generated (and published, if it has a GitHub token). */
export function markGenerated(path: string, audioBase64: string, wasPublished: boolean) {
  fresh.set(path, audioBase64);
  if (wasPublished) {
    published.add(path);
    notify();
  }
}
