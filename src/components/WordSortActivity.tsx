import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RotateCcw, Star, Volume2 } from 'lucide-react';
import { ODDBALL_ID, SortCategory, WordSort } from '../data/course';
import { audioService } from '../services/audioService';
import { headerSound } from '../services/phonemes';
import { getCourseWord, isPictureSort, shuffle, starsForMistakes } from '../services/course';

interface WordSortActivityProps {
  sort: WordSort;
  teacherVoice: 'Kore' | 'Puck' | 'Zephyr';
  onBack: () => void;
  onComplete: (stars: number) => void;
  onNext?: () => void;
}

export const WordSortActivity: React.FC<WordSortActivityProps> = ({ sort, teacherVoice, onBack, onComplete, onNext }) => {
  const [round, setRound] = useState(0);
  const deck = useMemo(() => shuffle(sort.cards), [sort.id, round]);
  const [placed, setPlaced] = useState<Record<string, string[]>>({});
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [wrongCategory, setWrongCategory] = useState<string | null>(null);
  const picture = isPictureSort(sort);
  const current = deck[index];
  const finished = index >= deck.length;
  const stars = starsForMistakes(mistakes, deck.length);

  useEffect(() => {
    setPlaced({});
    setIndex(0);
    setMistakes(0);
  }, [sort.id, round]);

  // Say each new card so the child can sort by ear
  useEffect(() => {
    if (current) audioService.speakPhonicsWord(current.word, { voiceName: teacherVoice });
  }, [current?.word, round]);

  useEffect(() => {
    if (finished && deck.length > 0) {
      audioService.playCelebrationFanfare();
      onComplete(stars);
    }
  }, [finished]);

  const playHeader = async (category: SortCategory) => {
    if (category.id === ODDBALL_ID) return;
    audioService.playChalkSound();
    await audioService.speakSound(headerSound(category.sound, category.label), { voiceName: teacherVoice, slow: true });
    await new Promise((r) => setTimeout(r, 300));
    await audioService.speakPhonicsWord(category.keyWord, { voiceName: teacherVoice });
  };

  const placeIn = async (category: SortCategory) => {
    if (!current) return;
    if (category.id === current.categoryId) {
      audioService.playCorrectSound();
      setPlaced((p) => ({ ...p, [category.id]: [...(p[category.id] || []), current.word] }));
      setIndex((i) => i + 1);
      return;
    }
    // Wrong column: shake it, then contrast the card with the right header's sound
    setMistakes((m) => m + 1);
    setWrongCategory(category.id);
    setTimeout(() => setWrongCategory(null), 500);
    const right = sort.categories.find((c) => c.id === current.categoryId);
    await audioService.speakPhonicsWord(current.word, { voiceName: teacherVoice, slow: true });
    if (right && right.id !== ODDBALL_ID) {
      await audioService.speakSound(headerSound(right.sound, right.label), { voiceName: teacherVoice, slow: true });
    }
  };

  const currentWord = current ? getCourseWord(current.word) : null;
  const columns = sort.categories.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700">
          <ArrowLeft className="w-4 h-4" /> Course
        </button>
        <div className="text-right">
          <div className="font-teacher font-extrabold text-lg text-slate-800 leading-tight">
            Sort {sort.number}: {sort.title}
          </div>
          <div className="text-xs text-slate-500">{sort.focusEs}</div>
        </div>
      </div>

      {/* Header columns */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${Math.min(columns, 3)}, minmax(0, 1fr))` }}
      >
        {sort.categories.map((category) => {
          const isOddball = category.id === ODDBALL_ID;
          const key = isOddball ? null : getCourseWord(category.keyWord);
          return (
            <div
              key={category.id}
              className={`rounded-2xl border-2 bg-white flex flex-col transition-transform ${
                wrongCategory === category.id ? 'border-red-400 animate-[shake_0.4s]' : 'border-slate-200'
              }`}
            >
              <button
                onClick={() => (current ? placeIn(category) : playHeader(category))}
                className={`p-2 rounded-t-2xl text-center ${isOddball ? 'bg-slate-100' : 'bg-amber-50'} active:bg-amber-100`}
              >
                <div className="text-2xl leading-none">{isOddball ? '🤔' : key?.emoji}</div>
                <div className="font-teacher font-extrabold text-xl text-slate-800">{isOddball ? 'Odd ones' : category.label}</div>
                <div className="text-[11px] text-slate-500 truncate">{isOddball ? 'don’t fit' : `${category.keyWord} ${category.sound}`}</div>
              </button>
              {!isOddball && (
                <button
                  onClick={() => playHeader(category)}
                  className="flex items-center justify-center gap-1 text-[11px] font-bold text-amber-700 py-1 border-t border-amber-100"
                  aria-label={`Listen to ${category.label}`}
                >
                  <Volume2 className="w-3 h-3" /> sound
                </button>
              )}
              <div className="flex flex-wrap gap-1 p-1.5 min-h-[2.5rem] border-t border-slate-100">
                {(placed[category.id] || []).map((w) => (
                  <button
                    key={w}
                    onClick={() => audioService.speakPhonicsWord(w, { voiceName: teacherVoice })}
                    className="px-1.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-bold"
                  >
                    {getCourseWord(w).emoji} {w}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Current card or result */}
      {!finished && currentWord ? (
        <div className="bg-slate-900 rounded-3xl p-5 text-center text-white">
          <div className="text-xs text-slate-400 mb-1">
            Card {index + 1} of {deck.length} · tap the right column
          </div>
          <button
            onClick={() => audioService.speakPhonicsWord(currentWord.word, { voiceName: teacherVoice })}
            className="mx-auto flex flex-col items-center gap-1"
          >
            <span className="text-6xl">{currentWord.emoji}</span>
            {!picture && <span className="font-teacher font-extrabold text-4xl">{currentWord.word}</span>}
            <span className="flex items-center gap-1 text-amber-300 text-sm font-bold">
              <Volume2 className="w-4 h-4" /> Listen
            </span>
          </button>
          <div className="flex justify-center gap-3 mt-3">
            <button
              onClick={() =>
                audioService.speakPhonicsWord(currentWord.word, {
                  voiceName: teacherVoice,
                  breakdown: true,
                  slow: true,
                  phonetics: currentWord.phonetics,
                })
              }
              className="px-3 py-1.5 rounded-full bg-white/10 text-sm font-bold"
            >
              🐢 Sound by sound
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-600 rounded-3xl p-5 text-center text-white space-y-3">
          <div className="font-teacher font-extrabold text-2xl">Sort complete!</div>
          <div className="flex justify-center gap-1">
            {[1, 2, 3].map((n) => (
              <Star key={n} className={`w-8 h-8 ${n <= stars ? 'fill-amber-300 text-amber-300' : 'text-emerald-300'}`} />
            ))}
          </div>
          <div className="text-sm text-emerald-100">
            {mistakes === 0 ? 'No mistakes!' : `${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'}`}
          </div>
          <div className="flex justify-center gap-2">
            <button onClick={() => setRound((r) => r + 1)} className="flex items-center gap-1 px-4 py-2 rounded-full bg-white/20 font-bold text-sm">
              <RotateCcw className="w-4 h-4" /> Try again
            </button>
            {onNext && (
              <button onClick={onNext} className="px-4 py-2 rounded-full bg-white text-emerald-700 font-bold text-sm">
                Next sort →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
