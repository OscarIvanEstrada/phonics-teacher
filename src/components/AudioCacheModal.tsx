import React, { useEffect, useState } from 'react';
import { ExternalLink, Github, X } from 'lucide-react';
import { AudioPlaybackEvent, isNativeApp } from '../services/audioService';
import { AUDIO_BRANCH, AUDIO_REPO } from '../services/audioPaths';
import { subscribePublishedAudio } from '../services/publishedAudio';

interface AudioCacheModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastEvent: AudioPlaybackEvent | null;
}

const SOURCE_LABEL: Record<AudioPlaybackEvent['source'], string> = {
  github: '📦 Leído de GitHub (ya estaba publicado)',
  vibevoice: '✨ Generado con VibeVoice (se publica en GitHub)',
  kokoro: '✨ Generado con Kokoro (se publica en GitHub)',
  chatterbox: '✨ Generado con Chatterbox (se publica en GitHub)',
  'ios-native': '📱 Voz del iPhone (no se publica)',
  'browser-fallback': '🗣️ Voz del navegador (respaldo)',
};

/** Published audio on GitHub, grouped by engine and voice. */
export const AudioCacheModal: React.FC<AudioCacheModalProps> = ({ isOpen, onClose, lastEvent }) => {
  const [paths, setPaths] = useState<string[]>([]);
  const [publishing, setPublishing] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = subscribePublishedAudio((p) => setPaths([...p]));
    if (!isNativeApp) {
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
              <h3 className="font-teacher font-extrabold text-xl leading-tight">Audios publicados</h3>
              <p className="text-xs text-slate-300">
                {AUDIO_REPO} · rama <code>{AUDIO_BRANCH}</code>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-4xl font-extrabold text-slate-800">{paths.length}</div>
              <div className="text-slate-500">audios en GitHub</div>
            </div>
            <a href={branchUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-600 font-bold">
              Ver en GitHub <ExternalLink className="w-4 h-4" />
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
              <div className="font-bold text-slate-800">Último audio: "{lastEvent.word}"</div>
              <div className="text-slate-600">{SOURCE_LABEL[lastEvent.source]}</div>
            </div>
          )}

          <div className="space-y-2 text-slate-600">
            <p>
              <strong>Lectura:</strong> la web y el iPhone buscan primero el audio en GitHub. Si ya existe, se descarga de
              ahí y no se vuelve a generar.
            </p>
            <p>
              <strong>Escritura:</strong> cuando falta, el servidor lo genera con el motor elegido y lo sube a GitHub para
              todos. El iPhone no puede publicar: si falta, usa su propia voz.
            </p>
            {!isNativeApp && (
              <p className={publishing?.startsWith('github') ? 'text-emerald-700' : 'text-amber-700'}>
                <strong>Publicación del servidor:</strong>{' '}
                {publishing?.startsWith('github') ? 'activa' : 'desactivada — añade GITHUB_TOKEN en .env'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
