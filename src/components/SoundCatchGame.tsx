import React, { useState, useEffect } from 'react';
import {
  Volume2,
  Sparkles,
  Trophy,
  Flame,
  RotateCcw,
  Star,
  CheckCircle2,
  XCircle,
  Play,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PHONICS_GROUPS } from '../data/phonicsCurriculum';
import { PhonicsWord } from '../types/phonics';
import { audioService } from '../services/audioService';

interface SoundCatchGameProps {
  onStarsEarned: (count: number) => void;
  teacherVoice: 'Kore' | 'Puck' | 'Zephyr';
}

export const SoundCatchGame: React.FC<SoundCatchGameProps> = ({
  onStarsEarned,
  teacherVoice,
}) => {
  // Pool of all words
  const allWords: PhonicsWord[] = React.useMemo(() => {
    return PHONICS_GROUPS.flatMap((g) => g.families.flatMap((f) => f.words));
  }, []);

  const [gameState, setGameState] = useState<'idle' | 'playing' | 'round_end'>('idle');
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [round, setRound] = useState<number>(1);
  const totalRounds = 5;

  const [targetWord, setTargetWord] = useState<PhonicsWord | null>(null);
  const [options, setOptions] = useState<PhonicsWord[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);

  const startNewQuestion = () => {
    setSelectedAnswer(null);
    setIsAnswerCorrect(null);

    // Pick 1 target word
    const randomIndex = Math.floor(Math.random() * allWords.length);
    const chosenTarget = allWords[randomIndex];
    setTargetWord(chosenTarget);

    // Pick 3 distractors
    const distractors: PhonicsWord[] = [];
    while (distractors.length < 3) {
      const dist = allWords[Math.floor(Math.random() * allWords.length)];
      if (dist.id !== chosenTarget.id && !distractors.some((d) => d.id === dist.id)) {
        distractors.push(dist);
      }
    }

    const shuffled = [chosenTarget, ...distractors].sort(() => 0.5 - Math.random());
    setOptions(shuffled);

    // Automatically speak the word
    setTimeout(() => {
      audioService.speakPhonicsWord(chosenTarget.word, { voiceName: teacherVoice });
    }, 300);
  };

  const handleStartGame = () => {
    setScore(0);
    setStreak(0);
    setRound(1);
    setGameState('playing');
    audioService.playChalkSound();
    startNewQuestion();
  };

  const handleRepeatSound = () => {
    if (targetWord) {
      audioService.speakPhonicsWord(targetWord.word, { voiceName: teacherVoice });
    }
  };

  const handlePickOption = (word: PhonicsWord) => {
    if (selectedAnswer !== null || !targetWord) return;

    setSelectedAnswer(word.id);
    const correct = word.id === targetWord.id;
    setIsAnswerCorrect(correct);

    if (correct) {
      audioService.playCorrectSound();
      audioService.playStarSound();
      setScore((s) => s + 10 + streak * 2);
      setStreak((st) => st + 1);
      onStarsEarned(2);

      if (streak + 1 >= 3) {
        confetti({
          particleCount: 35,
          spread: 60,
          origin: { y: 0.7 },
        });
      }
    } else {
      setStreak(0);
      audioService.playPopSound();
    }

    // Advance to next question or round end
    setTimeout(() => {
      if (round < totalRounds) {
        setRound((r) => r + 1);
        startNewQuestion();
      } else {
        setGameState('round_end');
        audioService.playCelebrationFanfare();
        confetti({
          particleCount: 75,
          spread: 100,
          origin: { y: 0.5 },
        });
        onStarsEarned(5); // Completion bonus
      }
    }, 1200);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-sky-600 to-blue-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl border-4 border-sky-300 relative overflow-hidden">
        {/* Header HUD */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <span className="bg-sky-950/60 text-sky-200 border border-sky-400/40 px-3 py-1 rounded-full text-xs font-teacher font-bold uppercase tracking-wider">
              🎮 Minijuego Auditivo
            </span>
            <h2 className="text-2xl sm:text-3xl font-teacher font-extrabold mt-1">
              Atrapa el Sonido Fonético
            </h2>
          </div>

          {gameState === 'playing' && (
            <div className="flex items-center gap-3">
              <div className="bg-sky-950/60 px-3 py-1.5 rounded-2xl border border-sky-400/30 text-center">
                <span className="text-[10px] text-sky-300 uppercase font-bold block">Puntos</span>
                <span className="font-teacher font-extrabold text-lg text-amber-300">{score}</span>
              </div>

              <div className="bg-sky-950/60 px-3 py-1.5 rounded-2xl border border-sky-400/30 text-center">
                <span className="text-[10px] text-orange-300 uppercase font-bold block flex items-center gap-0.5 justify-center">
                  <Flame className="w-3 h-3 text-orange-400 fill-orange-400" /> Racha
                </span>
                <span className="font-teacher font-extrabold text-lg text-white">{streak}x</span>
              </div>

              <div className="bg-sky-950/60 px-3 py-1.5 rounded-2xl border border-sky-400/30 text-center">
                <span className="text-[10px] text-sky-300 uppercase font-bold block">Ronda</span>
                <span className="font-teacher font-extrabold text-lg text-white">
                  {round}/{totalRounds}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Game State: IDLE */}
        {gameState === 'idle' && (
          <div className="text-center py-10 max-w-lg mx-auto space-y-4">
            <div className="text-6xl animate-bounce">🎧🫧</div>
            <h3 className="font-teacher font-extrabold text-2xl text-white">
              ¡Entrena tu oído para reconocer cada sonido!
            </h3>
            <p className="text-xs sm:text-sm text-sky-100 font-medium leading-relaxed">
              El profesor pronunciará una palabra en inglés con <strong>voz del profesor IA</strong>. Tu misión es
              atrapar la tarjeta correcta entre las opciones antes de que termine el tiempo.
            </p>
            <button
              onClick={handleStartGame}
              className="px-8 py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-900 font-teacher font-extrabold text-base shadow-xl transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-slate-900" />
              <span>¡Comenzar Desafío!</span>
            </button>
          </div>
        )}

        {/* Game State: PLAYING */}
        {gameState === 'playing' && targetWord && (
          <div className="space-y-6 max-w-2xl mx-auto text-center">
            {/* Audio Button Prompt */}
            <div className="p-4 bg-sky-950/50 rounded-2xl border border-sky-400/30 inline-flex flex-col items-center">
              <span className="text-xs text-sky-200 font-teacher font-semibold mb-2">
                Escucha la pronunciación del profesor:
              </span>
              <button
                onClick={handleRepeatSound}
                className="px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-900 font-teacher font-extrabold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <Volume2 className="w-5 h-5 animate-pulse" />
                <span>Repetir Sonido ({teacherVoice})</span>
              </button>
            </div>

            {/* Bubble Word Cards Grid */}
            <div className="grid grid-cols-2 gap-4">
              {options.map((opt) => {
                const isSelected = selectedAnswer === opt.id;
                const isTarget = opt.id === targetWord.id;

                let cardStyle =
                  'bg-white/15 hover:bg-white/25 border-white/20 text-white hover:scale-105';
                if (selectedAnswer !== null) {
                  if (isTarget) {
                    cardStyle = 'bg-emerald-500 border-white text-white scale-105 ring-4 ring-white';
                  } else if (isSelected && !isAnswerCorrect) {
                    cardStyle = 'bg-rose-500 border-rose-300 text-white animate-shake';
                  } else {
                    cardStyle = 'opacity-40 bg-white/10 border-transparent text-white/50';
                  }
                }

                return (
                  <button
                    key={opt.id}
                    disabled={selectedAnswer !== null}
                    onClick={() => handlePickOption(opt)}
                    className={`p-5 rounded-3xl border-3 font-teacher text-left transition-all duration-200 cursor-pointer shadow-lg flex items-center gap-3 ${cardStyle}`}
                  >
                    <span className="text-4xl filter drop-shadow">{opt.emoji}</span>
                    <div>
                      <div className="text-2xl sm:text-3xl font-extrabold tracking-wide">
                        {opt.word}
                      </div>
                      <div className="text-xs text-sky-200 font-mono font-bold">
                        {opt.phonetics}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Answer Result Banner */}
            {selectedAnswer !== null && (
              <div
                className={`p-3 rounded-2xl font-teacher font-extrabold text-sm inline-flex items-center gap-2 ${
                  isAnswerCorrect
                    ? 'bg-emerald-400 text-slate-950 shadow-md'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {isAnswerCorrect ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-slate-950" />
                    <span>¡Correcto! {targetWord.word} ({targetWord.meaningEs})</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5" />
                    <span>¡Casi! La palabra era {targetWord.word}</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Game State: ROUND_END */}
        {gameState === 'round_end' && (
          <div className="text-center py-10 max-w-md mx-auto space-y-4">
            <div className="text-6xl animate-bounce">🏆⭐</div>
            <h3 className="font-teacher font-extrabold text-3xl text-amber-300">
              ¡Ronda Completada!
            </h3>
            <p className="text-sm text-sky-100 font-medium">
              Obtuviste <strong className="text-white text-lg">{score} puntos</strong> y ganaste{' '}
              <strong className="text-amber-300 text-lg">+5 Estrellas extra</strong> para tu frasco escolar.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={handleStartGame}
                className="px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-900 font-teacher font-extrabold text-sm shadow-xl transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Jugar Otra Ronda</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
