import React, { useEffect, useState } from 'react';
import { ExternalLink, Github, X } from 'lucide-react';
import { AudioPlaybackEvent, isNativeApp } from '../services/audioService';
import { AUDIO_BRANCH, AUDIO_REPO } from '../services/audioPaths';
import { subscribePublishedAudio } from '../services/publishedAudio';
import { IS_STATIC } from '../config';

interface AudioCacheModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastEvent: AudioPlaybackEvent | null;
}

const SOURCE_LABEL: Record<AudioPlaybackEvent['source'], string> = {
  github: '📦 Loaded from GitHub (already published)',
  kokoro: '✨ Made with Kokoro (published to GitHub)',
  chatterbox: '✨ Made with Chatterbox (published to GitHub)',
  'ios-native': '📱 iPhone voice (not published)',
  'browser-fallback': '🗣️ Browser voice (backup)',
};

/** Published audio on GitHub, grouped by engine and voice. */
export const AudioCacheModal: React.FC<AudioCacheModalProps> = ({ isOpen, onClose, lastEvent }) => {
  const [paths, setPaths] = useState<string[]>([]);
  const [publishing, setPublishing] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = subscribePublishedAudio((p) => setPaths([...p]));
    if (!isNativeApp && !IS_STATIC) {
      fetch('/api/health')
        .then((r) => r.json())
        .then((h) => setPublishing(h.audioPublishing ?? null))
        .catch(() => setPublishing(null));
    }
    return unsubscribe;
  }, [isOpen]);

  if (!isOpen) return null;

  // "audio/<engine>/<voice>/..." → counts per engine and voice
  const groups = new Map<string, number>();
  for (const p of paths) {
    const [, engine, voice] = p.split('/');
    const key = `${engine} · ${voice}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const branchUrl = `https://github.com/${AUDIO_REPO}/tree/${AUDIO_BRANCH}/audio`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Github className="w-6 h-6" />
            <div>
              <h3 className="font-teacher font-extrabold text-xl leading-tight">Published audio</h3>
              <p className="text-xs text-slate-300">
                {AUDIO_REPO} · <code>audio/</code> on <code>{AUDIO_BRANCH}</code>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-4xl font-extrabold text-slate-800">{paths.length}</div>
              <div className="text-slate-500">audio files on GitHub</div>
            </div>
            <a href={branchUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-600 font-bold">
              See on GitHub <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {groups.size > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {[...groups.entries()].sort().map(([key, count]) => (
                <div key={key} className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 flex justify-between">
                  <span className="font-semibold text-slate-700 capitalize">{key}</span>
                  <span className="font-bold text-slate-900">{count}</span>
                </div>
              ))}
            </div>
          )}

          {lastEvent && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
              <div className="font-bold text-slate-800">Last audio: "{lastEvent.word}"</div>
              <div className="text-slate-600">{SOURCE_LABEL[lastEvent.source]}</div>
            </div>
          )}

          <div className="space-y-2 text-slate-600">
            <p>
              <strong>Reading:</strong> the website and the iPhone look for the audio on GitHub first. If it is already there,
              it is downloaded and not made again.
            </p>
            <p>
              <strong>Writing:</strong> when it is missing, the server makes it with the chosen engine and uploads it to GitHub
              for everyone. The iPhone cannot publish: if audio is missing, it uses its own voice.
            </p>
            {!isNativeApp && !IS_STATIC && (
              <p className={publishing?.startsWith('github') ? 'text-emerald-700' : 'text-amber-700'}>
                <strong>Server publishing:</strong>{' '}
                {publishing?.startsWith('github') ? 'on' : 'off — add GITHUB_TOKEN to .env'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
