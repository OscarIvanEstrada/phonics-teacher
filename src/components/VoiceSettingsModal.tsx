import React, { useEffect, useState } from 'react';
import { Check, Play, Square, X } from 'lucide-react';
import { TEACHER_PROFILES } from './TeacherAvatar';
import { audioService, TtsEngine } from '../services/audioService';
import {
  NativeTTS,
  NativeVoice,
  NATIVE_RATE,
  TeacherVoiceKey,
  defaultVoiceFor,
  getVoicePrefs,
  listEnglishVoices,
  setVoicePref,
} from '../services/nativeTts';

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The published-audio engine was changed here (App keeps the counter in sync) */
  onEngineChange: (engine: TtsEngine) => void;
}

const PREVIEW_TEXT = 'Hello, friend! Let us read together: cat, hat, bat. Great job!';

const QUALITY_LABEL: Record<NativeVoice['quality'], { text: string; className: string }> = {
  premium: { text: 'Premium', className: 'bg-amber-100 text-amber-800' },
  enhanced: { text: 'Mejorada', className: 'bg-emerald-100 text-emerald-800' },
  default: { text: 'Básica', className: 'bg-slate-100 text-slate-500' },
};

const TEACHERS = Object.values(TEACHER_PROFILES);

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({ isOpen, onClose, onEngineChange }) => {
  const [voices, setVoices] = useState<NativeVoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [teacher, setTeacher] = useState<TeacherVoiceKey>(TEACHERS[0].voice);
  const [prefs, setPrefs] = useState(getVoicePrefs());
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [engine, setEngine] = useState<TtsEngine>(audioService.getEngine());

  const chooseEngine = (value: TtsEngine) => {
    onEngineChange(value);
    setEngine(value);
  };

  useEffect(() => {
    if (!isOpen) return;
    listEnglishVoices()
      .then(setVoices)
      .catch((err) => setError(`No se pudieron leer las voces del iPhone: ${err.message || err}`));
    return () => {
      NativeTTS.stop().catch(() => {});
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedId = prefs[teacher] ?? defaultVoiceFor(teacher, voices)?.id;

  const preview = async (voice: NativeVoice) => {
    audioService.stopCurrentAudio();
    if (previewingId === voice.id) {
      await NativeTTS.stop();
      setPreviewingId(null);
      return;
    }
    setPreviewingId(voice.id);
    await NativeTTS.speak({ text: PREVIEW_TEXT, voiceId: voice.id, rate: NATIVE_RATE.normal }).catch(console.warn);
    setPreviewingId((current) => (current === voice.id ? null : current));
  };

  const choose = (voice: NativeVoice) => {
    if (voice.id === selectedId && prefs[teacher]) return;
    setVoicePref(teacher, voice.id);
    setPrefs(getVoicePrefs());
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
        <div className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-teacher font-extrabold text-xl leading-tight">Voces del iPhone</h3>
            <p className="text-xs text-indigo-100 font-medium">Escucha cada voz y elige la de cada profesor</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Which published GitHub audio to play; the iPhone voice below is used when one is missing */}
        <div className="px-4 pt-4">
          <div className="text-xs font-bold text-slate-500 mb-1.5">Audios publicados en GitHub</div>
          <div className="flex gap-2">
            {(['vibevoice', 'kokoro', 'chatterbox'] as TtsEngine[]).map((value) => (
              <button
                key={value}
                onClick={() => chooseEngine(value)}
                className={`px-3 py-1.5 rounded-full text-sm font-bold capitalize ${
                  engine === value ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-400 mt-1">Si un audio aún no está publicado, se usa la voz del iPhone elegida abajo.</div>
        </div>

        <div className="flex gap-2 px-4 pt-4 overflow-x-auto">
          {TEACHERS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTeacher(t.voice)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-bold transition-colors ${
                teacher === t.voice ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t.emoji} {t.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}
          {!error && voices.length === 0 && <p className="text-sm text-slate-500">Cargando voces…</p>}
          {voices.map((voice) => {
            const isSelected = voice.id === selectedId;
            const quality = QUALITY_LABEL[voice.quality];
            return (
              <div
                key={voice.id}
                className={`flex items-center gap-3 p-3 rounded-2xl border-2 ${
                  isSelected ? 'border-indigo-400 bg-indigo-50' : 'border-slate-100 bg-white'
                }`}
              >
                <button
                  onClick={() => preview(voice)}
                  className="w-10 h-10 shrink-0 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center"
                  aria-label={`Probar ${voice.name}`}
                >
                  {previewingId === voice.id ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 truncate">{voice.name}</div>
                  <div className="flex items-center gap-1.5 text-xs mt-0.5">
                    <span className="text-slate-500">{voice.language}</span>
                    <span className={`px-1.5 py-0.5 rounded-md font-bold ${quality.className}`}>{quality.text}</span>
                    {voice.gender !== 'unspecified' && (
                      <span className="text-slate-400">{voice.gender === 'male' ? 'Hombre' : 'Mujer'}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => choose(voice)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold ${
                    isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isSelected ? (
                    <span className="flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Elegida
                    </span>
                  ) : (
                    'Usar'
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <p className="px-4 pb-4 pt-2 text-xs text-slate-500 border-t border-slate-100">
          💡 Para voces más naturales, descarga voces <strong>Mejoradas</strong> o <strong>Premium</strong> en inglés en
          Ajustes → Accesibilidad → Contenido leído → Voces → English, y vuelve a abrir esta ventana.
        </p>
      </div>
    </div>
  );
};
