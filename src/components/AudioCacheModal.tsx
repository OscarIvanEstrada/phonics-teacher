import React, { useState, useEffect } from 'react';
import {
  Database,
  HardDrive,
  Sparkles,
  Trash2,
  X,
  Volume2,
  CheckCircle2,
  Layers,
  Zap,
} from 'lucide-react';
import { getAudioCacheStats, clearAudioCache, CachedAudioRecord } from '../services/indexedDb';
import { audioService, AudioPlaybackEvent } from '../services/audioService';

interface AudioCacheModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastEvent: AudioPlaybackEvent | null;
}

export const AudioCacheModal: React.FC<AudioCacheModalProps> = ({
  isOpen,
  onClose,
  lastEvent,
}) => {
  const [clientStats, setClientStats] = useState<{
    count: number;
    totalPlaysSaved: number;
    items: CachedAudioRecord[];
  }>({ count: 0, totalPlaysSaved: 0, items: [] });

  const [serverStats, setServerStats] = useState<{
    cachedAudiosCount: number;
    cacheSizeBytes: number;
  }>({ cachedAudiosCount: 0, cacheSizeBytes: 0 });

  const [isClearing, setIsClearing] = useState(false);

  const loadAllStats = async () => {
    try {
      const cStats = await getAudioCacheStats();
      setClientStats(cStats);

      const res = await fetch('/api/tts/stats');
      if (res.ok) {
        const sStats = await res.json();
        setServerStats(sStats);
      }
    } catch (err) {
      console.warn('Failed loading cache stats:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAllStats();
    }
  }, [isOpen]);

  const handleClearClientCache = async () => {
    if (window.confirm('¿Deseas vaciar la caché de audios de IndexedDB en el navegador?')) {
      setIsClearing(true);
      await clearAudioCache();
      await loadAllStats();
      setIsClearing(false);
    }
  };

  const handleClearServerCache = async () => {
    if (window.confirm('¿Deseas vaciar la caché de audios del servidor?')) {
      setIsClearing(true);
      await fetch('/api/tts/clear-cache', { method: 'POST' });
      await loadAllStats();
      setIsClearing(false);
    }
  };

  if (!isOpen) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl border-4 border-amber-300 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-xl">
              ⚡
            </div>
            <div>
              <h3 className="font-teacher font-extrabold text-xl leading-tight">
                Sistema de Caché y Ahorro de VibeVoice TTS
              </h3>
              <p className="text-xs text-amber-100 font-medium">
                Almacenamiento multinivel en IndexedDB y Disco para evitar consumo excesivo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Real-Time Saver Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. IndexedDB Client */}
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-200 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-800 uppercase font-teacher mb-1">
                <Database className="w-4 h-4 text-amber-600" />
                IndexedDB (Navegador)
              </div>
              <div className="font-teacher font-extrabold text-3xl text-amber-900">
                {clientStats.count}
              </div>
              <div className="text-[11px] text-amber-700 font-medium mt-0.5">
                Audios guardados localmente
              </div>
            </div>

            {/* 2. Server Disk Cache */}
            <div className="p-4 rounded-2xl bg-sky-50 border-2 border-sky-200 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-sky-800 uppercase font-teacher mb-1">
                <HardDrive className="w-4 h-4 text-sky-600" />
                Caché en Servidor
              </div>
              <div className="font-teacher font-extrabold text-3xl text-sky-900">
                {serverStats.cachedAudiosCount}
              </div>
              <div className="text-[11px] text-sky-700 font-medium mt-0.5">
                Archivos ({formatBytes(serverStats.cacheSizeBytes)})
              </div>
            </div>

            {/* 3. API Calls Avoided */}
            <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-800 uppercase font-teacher mb-1">
                <Zap className="w-4 h-4 text-emerald-600" />
                Consumo Ahorrado
              </div>
              <div className="font-teacher font-extrabold text-3xl text-emerald-900">
                {clientStats.totalPlaysSaved}x
              </div>
              <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                Síntesis evitadas
              </div>
            </div>
          </div>

          {/* Last Audio Activity Banner */}
          {lastEvent && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-4 h-4 text-amber-600 animate-pulse" />
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    Última reproducción: <span className="font-teacher font-extrabold text-amber-700 text-sm">"{lastEvent.word}"</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    {lastEvent.source === 'indexeddb' && 'Fuente: 💾 IndexedDB del Navegador (0 ms latencia, 0 consumo)'}
                    {lastEvent.source === 'server-cache' && 'Fuente: 🖥️ Caché en Disco del Servidor (0 consumo de API Gemini)'}
                    {lastEvent.source === 'vibevoice' && 'Fuente: ✨ Llamada a VibeVoice TTS (guardada en caché para futuras reproducciones)'}
                    {lastEvent.source === 'chatterbox' && 'Fuente: ✨ Llamada a Chatterbox Turbo (guardada en caché para futuras reproducciones)'}
                    {lastEvent.source === 'kokoro' && 'Fuente: ✨ Llamada a Kokoro TTS (guardada en caché para futuras reproducciones)'}
                    {lastEvent.source === 'browser-fallback' && 'Fuente: 🗣️ Síntesis de voz del navegador (Modo de respaldo activo)'}
                  </div>
                </div>
              </div>

              <span
                className={`text-[11px] font-teacher font-bold px-2.5 py-1 rounded-full ${
                  lastEvent.fromCache
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : lastEvent.source === 'browser-fallback'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-purple-100 text-purple-800 border border-purple-300'
                }`}
              >
                {lastEvent.fromCache
                  ? '✓ 0 Consumo (Caché)'
                  : lastEvent.source === 'browser-fallback'
                  ? '🗣️ Voz Local'
                  : '✨ Primera vez (VibeVoice)'}
              </span>

              {lastEvent.source === 'browser-fallback' && (
                <div className="w-full mt-2 text-[11px] text-amber-900 bg-amber-100/80 p-2.5 rounded-xl border border-amber-300 leading-relaxed">
                  💡 <strong>¿Por qué dice "browser-fallback"?</strong> Significa que el servidor intentó conectar con VibeVoice TTS, pero al no tener una clave de API válida activa en el panel <strong>Settings &gt; Secrets</strong>, activó el <strong>sistema de seguridad y respaldo local</strong> para que los niños nunca se queden sin escuchar la pronunciación. Al colocar una clave activa en Secrets, VibeVoice TTS se activará automáticamente y guardará los audios en IndexedDB.
                </div>
              )}
            </div>
          )}

          {/* How Caching Works Explainer */}
          <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50/50 rounded-2xl border border-amber-200/80 space-y-2">
            <h4 className="font-teacher font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-600" />
              ¿Cómo protege esta arquitectura tu cuota de Gemini?
            </h4>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4 font-medium leading-relaxed">
              <li>
                <strong>Nivel 1 (IndexedDB Local):</strong> Cada audio generado se guarda en base64 en tu navegador. Cuando presionas una palabra ya reproducida, se emite directamente desde la memoria de tu equipo.
              </li>
              <li>
                <strong>Nivel 2 (Caché en Servidor Express):</strong> Si abres la app en otra ventana o refrescas, el servidor busca en su directorio persistente `.audio_cache` antes de contactar con la API de Google Gemini.
              </li>
              <li>
                <strong>Resultado:</strong> Cada palabra o sonido se genera <strong>una sola vez</strong>. Las siguientes 100 veces que el niño practique no gastarán tokens ni cuota.
              </li>
            </ul>
          </div>

          {/* Recently Stored Audios in IndexedDB List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-teacher font-bold text-slate-700 text-xs uppercase tracking-wider">
                Audios almacenados en este navegador ({clientStats.items.length}):
              </h4>
              <button
                onClick={handleClearClientCache}
                disabled={isClearing || clientStats.count === 0}
                className="text-[11px] font-teacher font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                <Trash2 className="w-3 h-3" />
                <span>Vaciar caché del navegador</span>
              </button>
            </div>

            {clientStats.items.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl text-center">
                Aún no has reproducido audios. Al presionar el altavoz en cualquier palabra se guardará automáticamente aquí.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-2xl p-2 bg-slate-50">
                {clientStats.items.slice(-20).reverse().map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-teacher font-bold text-slate-800 text-sm">
                        {item.word}
                      </span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-mono font-semibold">
                        Voz: {item.voiceName}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-teacher font-bold text-emerald-700">
                        {item.timesPlayed || 1} reproducciones ({Math.max(0, (item.timesPlayed || 1) - 1)} ahorradas)
                      </span>
                      <button
                        onClick={() => audioService.speakPhonicsWord(item.word || '', { voiceName: item.voiceName as any })}
                        className="p-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 cursor-pointer"
                        title="Probar reproducción desde caché"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={handleClearServerCache}
            disabled={isClearing || serverStats.cachedAudiosCount === 0}
            className="text-xs font-teacher font-bold text-slate-600 hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpiar caché servidor ({serverStats.cachedAudiosCount} archivos)</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-teacher font-bold text-xs shadow cursor-pointer transition-transform active:scale-95"
          >
            Entendido, cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
