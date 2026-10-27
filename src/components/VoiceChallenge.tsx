import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  Star,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PhonicsWord } from '../types/phonics';
import { PHONICS_GROUPS } from '../data/phonicsCurriculum';
import { phonicsSpeechRecognizer, PronunciationResult } from '../services/speechRecognition';
import { audioService } from '../services/audioService';
import { recordWordPractice } from '../services/indexedDb';

interface VoiceChallengeProps {
  currentWord: PhonicsWord | null;
  onSelectWord: (word: PhonicsWord) => void;
  onStarsEarned: (count: number) => void;
  teacherVoice: 'Kore' | 'Puck' | 'Zephyr';
}

export const VoiceChallenge: React.FC<VoiceChallengeProps> = ({
  currentWord,
  onSelectWord,
  onStarsEarned,
  teacherVoice,
}) => {
  // Collect a pool of words for quick selection
  const sampleWords: PhonicsWord[] = React.useMemo(() => {
    return PHONICS_GROUPS.flatMap((g) => g.families.flatMap((f) => f.words)).slice(0, 36);
  }, []);

  const activeWord: PhonicsWord = currentWord || sampleWords[0];

  const [isListening, setIsListening] = useState<boolean>(false);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isMicSupported = phonicsSpeechRecognizer.isSupported();

  const handleListenTeacher = () => {
    audioService.playChalkSound();
    audioService.speakPhonicsWord(activeWord.word, { voiceName: teacherVoice });
  };

  const handleListenSlow = () => {
    audioService.playChalkSound();
    audioService.speakPhonicsWord(activeWord.word, {
      voiceName: teacherVoice,
      breakdown: true,
      slow: true,
    });
  };

  const handleStartSpeaking = () => {
    setErrorMessage(null);
    setResult(null);
    setIsListening(true);
    audioService.playChalkSound();

    phonicsSpeechRecognizer.startListening(
      activeWord.word,
      async (res) => {
        setIsListening(false);
        setResult(res);

        // Record in IndexedDB
        await recordWordPractice(activeWord.id, res.isMatch, res.stars);

        // Award stars to student
        onStarsEarned(res.stars);

        if (res.stars === 3) {
          audioService.playCelebrationFanfare();
          confetti({
            particleCount: 60,
            spread: 80,
            origin: { y: 0.6 },
          });
        } else if (res.stars === 2) {
          audioService.playCorrectSound();
        } else {
          audioService.playStarSound();
        }
      },
      (err) => {
        setIsListening(false);
        setErrorMessage(err);
      },
      () => {
        setIsListening(false);
      }
    );
  };

  const handleNextWord = () => {
    const currentIndex = sampleWords.findIndex((w) => w.id === activeWord.id);
    const nextWord = sampleWords[(currentIndex + 1) % sampleWords.length];
    onSelectWord(nextWord);
    setResult(null);
    setErrorMessage(null);
  };

  return (
    <div className="space-y-6">
      {/* Challenge Card */}
      <div className="bg-gradient-to-b from-emerald-600 to-teal-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl border-4 border-emerald-400 relative overflow-hidden">
        {/* Background decorative circles */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto text-center space-y-5">
          {/* Top Instruction */}
          <div className="inline-flex items-center gap-2 bg-emerald-950/70 text-emerald-200 border border-emerald-400/30 px-3.5 py-1 rounded-full text-xs font-teacher font-bold uppercase tracking-wider">
            <Mic className="w-3.5 h-3.5 text-emerald-300" />
            Reto de Pronunciación en Voz Alta
          </div>

          {/* Target Word Hero Display */}
          <div className="py-2">
            <div className="text-6xl sm:text-7xl mb-2 animate-float filter drop-shadow">
              {activeWord.emoji}
            </div>
            <h2 className="text-5xl sm:text-6xl font-teacher font-extrabold tracking-wider text-white">
              <span className="text-amber-300">{activeWord.onset}</span>
              <span className="text-white underline decoration-amber-400 decoration-4 underline-offset-8">
                {activeWord.rime}
              </span>
            </h2>
            <div className="flex items-center justify-center gap-3 mt-3">
              <span className="text-sm font-mono font-bold bg-emerald-950/60 text-emerald-200 px-3 py-1 rounded-xl border border-emerald-400/30">
                {activeWord.phonetics}
              </span>
              <span className="text-sm font-teacher font-bold text-amber-200 bg-emerald-900/60 px-3 py-1 rounded-xl">
                Español: {activeWord.meaningEs}
              </span>
            </div>
            <p className="text-xs text-emerald-100 italic mt-2">
              "{activeWord.exampleSentence}"
            </p>
          </div>

          {/* Teacher Audio Helpers */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={handleListenTeacher}
              className="px-4 py-2 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/25 text-white font-teacher font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Escuchar pronunciación estándar con VibeVoice TTS"
            >
              <Volume2 className="w-4 h-4 text-amber-300" />
              <span>Escuchar al Profesor</span>
            </button>

            <button
              onClick={handleListenSlow}
              className="px-4 py-2 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/25 text-white font-teacher font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Escuchar desglose fonético lento"
            >
              <RotateCcw className="w-3.5 h-3.5 text-sky-300" />
              <span>Escuchar Lento (/k/ ... /æt/)</span>
            </button>
          </div>

          {/* Main Action: Microphone Button */}
          <div className="py-4">
            <div className="flex flex-col items-center justify-center gap-3">
              <button
                onClick={handleStartSpeaking}
                disabled={isListening}
                className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-200 cursor-pointer border-4 border-white ${
                  isListening
                    ? 'bg-rose-500 scale-110 ring-8 ring-rose-300 animate-pulse'
                    : 'bg-gradient-to-tr from-amber-400 to-orange-500 hover:scale-105 active:scale-95 hover:shadow-amber-500/50'
                }`}
                title="Presiona y pronuncia la palabra"
              >
                {isListening ? (
                  <MicOff className="w-10 h-10 animate-spin" />
                ) : (
                  <Mic className="w-11 h-11" />
                )}
              </button>

              <span className="font-teacher font-extrabold text-sm sm:text-base text-white tracking-wide">
                {isListening
                  ? '🎙️ ¡El profesor te está escuchando! ¡Habla ahora!'
                  : '👆 ¡Toca el micrófono y pronuncia la palabra!'}
              </span>
            </div>
          </div>

          {/* Results Feedback Box */}
          {result && (
            <div
              className={`p-4 sm:p-5 rounded-2xl text-left border-2 shadow-lg transition-all ${
                result.stars === 3
                  ? 'bg-amber-100 text-amber-950 border-amber-400'
                  : result.stars === 2
                  ? 'bg-emerald-100 text-emerald-950 border-emerald-400'
                  : 'bg-sky-100 text-sky-950 border-sky-400'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3].map((s) => (
                    <Star
                      key={s}
                      className={`w-6 h-6 ${
                        s <= result.stars
                          ? 'text-amber-500 fill-amber-400 animate-bounce'
                          : 'text-slate-300 fill-slate-200'
                      }`}
                    />
                  ))}
                  <span className="font-teacher font-extrabold text-sm ml-2">
                    +{result.stars} Estrellas Ganadas
                  </span>
                </div>
                <span className="text-xs font-bold font-mono bg-white/70 px-2 py-0.5 rounded-md">
                  Puntuación: {result.score}%
                </span>
              </div>

              <p className="font-teacher font-bold text-base leading-snug">
                {result.feedbackEs}
              </p>
              <p className="text-xs text-slate-600 mt-1 italic">
                "{result.feedbackEn}" (Escuchado: "{result.transcript}")
              </p>

              <div className="mt-3 pt-3 border-t border-black/10 flex items-center justify-end">
                <button
                  onClick={handleNextWord}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-teacher font-bold text-xs hover:bg-slate-800 transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Siguiente palabra</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-900/80 border border-rose-400/40 text-rose-100 rounded-2xl text-xs flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-300" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!isMicSupported && (
            <div className="p-3 bg-amber-950/80 border border-amber-400/30 text-amber-200 rounded-2xl text-xs flex items-center justify-center gap-2">
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <span>
                Tip: Para usar el micrófono recomendamos Chrome o Edge. También puedes practicar
                escuchando la pronunciación lenta con VibeVoice TTS.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Word Quick Selector Carousel */}
      <div className="bg-white rounded-3xl p-5 border-2 border-slate-200 shadow-sm">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-teacher mb-3">
          Otras palabras para desafiarte hoy:
        </h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {sampleWords.map((w) => {
            const isSelected = w.id === activeWord.id;
            return (
              <button
                key={w.id}
                onClick={() => {
                  onSelectWord(w);
                  setResult(null);
                  setErrorMessage(null);
                }}
                className={`px-3 py-2 rounded-2xl border-2 font-teacher font-bold text-xs sm:text-sm flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md scale-105'
                    : 'bg-slate-50 text-slate-700 hover:bg-emerald-50 border-slate-200'
                }`}
              >
                <span>{w.emoji}</span>
                <span>{w.word}</span>
                <span className="text-[10px] text-slate-400 font-mono">({w.rime})</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
