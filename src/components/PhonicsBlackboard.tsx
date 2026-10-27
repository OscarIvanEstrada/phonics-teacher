import React, { useState } from 'react';
import {
  Volume2,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Mic,
  Lightbulb,
  CheckCircle2,
} from 'lucide-react';
import { BLACKBOARD_GROUPS as PHONICS_GROUPS } from '../data/blackboardGroups';
import { PhonicsWord, WordFamily } from '../types/phonics';
import { audioService } from '../services/audioService';
import { splitOnsetRime } from '../services/phonemes';
import { WordMasteryRecord } from '../services/indexedDb';

interface PhonicsBlackboardProps {
  selectedGroupIndex: number;
  onSelectGroupIndex: (index: number) => void;
  selectedFamilyId: string;
  onSelectFamilyId: (familyId: string) => void;
  masteryMap: Record<string, WordMasteryRecord>;
  onPracticeWordInVoice: (word: PhonicsWord) => void;
  teacherVoice: 'Kore' | 'Puck' | 'Zephyr';
  cachedAudioKeys?: Set<string>;
}

export const PhonicsBlackboard: React.FC<PhonicsBlackboardProps> = ({
  selectedGroupIndex,
  onSelectGroupIndex,
  selectedFamilyId,
  onSelectFamilyId,
  masteryMap,
  onPracticeWordInVoice,
  teacherVoice,
  cachedAudioKeys = new Set(),
}) => {
  const currentGroup = PHONICS_GROUPS[selectedGroupIndex] || PHONICS_GROUPS[0];
  const currentFamily: WordFamily =
    currentGroup.families.find((f) => f.id === selectedFamilyId) || currentGroup.families[0];

  // Blending interactive toy state
  const [selectedWordForBlend, setSelectedWordForBlend] = useState<PhonicsWord>(
    currentFamily.words[0] || null
  );
  const [isBlending, setIsBlending] = useState<boolean>(false);
  const [activePlayingWord, setActivePlayingWord] = useState<string | null>(null);

  // Update selected blend word when family changes
  React.useEffect(() => {
    if (currentFamily && currentFamily.words.length > 0) {
      setSelectedWordForBlend(currentFamily.words[0]);
    }
  }, [currentFamily.id]);

  const handlePlayWord = async (word: PhonicsWord, slowBreakdown: boolean = false) => {
    setActivePlayingWord(word.id);
    audioService.playChalkSound();
    try {
      await audioService.speakPhonicsWord(word.word, {
        voiceName: teacherVoice,
        breakdown: slowBreakdown,
        slow: slowBreakdown,
        phonetics: word.phonetics,
      });
    } finally {
      setActivePlayingWord(null);
    }
  };

  // Onset and rime are said as sounds (/k/, /æn/), never as letter names
  const blendParts = selectedWordForBlend
    ? splitOnsetRime(selectedWordForBlend.phonetics, selectedWordForBlend.rime)
    : { onset: [], rime: null };

  const speakOnset = async () => {
    for (const sound of blendParts.onset) {
      await audioService.speakSound(sound, { voiceName: teacherVoice, slow: true });
      await new Promise((r) => setTimeout(r, 250));
    }
  };

  const handlePlayOnset = () => {
    audioService.playChalkSound();
    speakOnset();
  };

  const handlePlayRime = () => {
    audioService.playChalkSound();
    if (blendParts.rime) audioService.speakSound(blendParts.rime, { voiceName: teacherVoice, slow: true });
  };

  const handleTriggerBlend = async () => {
    if (!selectedWordForBlend) return;
    setIsBlending(true);
    audioService.playChalkSound();

    // 1. Speak onset sound(s)
    await speakOnset();
    await new Promise((r) => setTimeout(r, 450));

    // 2. Speak rime as one blended sound
    if (blendParts.rime) await audioService.speakSound(blendParts.rime, { voiceName: teacherVoice, slow: true });
    await new Promise((r) => setTimeout(r, 450));

    // 3. Blend together
    audioService.playCorrectSound();
    await audioService.speakPhonicsWord(selectedWordForBlend.word, { voiceName: teacherVoice });
    setIsBlending(false);
  };

  return (
    <div className="space-y-6">
      {/* Group Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {PHONICS_GROUPS.map((group, idx) => {
          const isSelected = selectedGroupIndex === idx;
          return (
            <button
              key={group.id}
              onClick={() => {
                onSelectGroupIndex(idx);
                onSelectFamilyId(group.families[0].id);
              }}
              className={`px-3 py-2 rounded-2xl font-teacher text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-amber-600 text-white shadow-md scale-105'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-amber-50'
              }`}
            >
              <span>{group.badge}</span>
              <span>{group.title.split('.')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Main Classroom Blackboard Frame */}
      <div className="wood-border blackboard-texture rounded-3xl p-5 sm:p-7 text-white shadow-2xl relative overflow-hidden">
        {/* Blackboard Chalk Header */}
        <div className="border-b border-white/20 pb-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase font-extrabold tracking-widest text-amber-300 bg-amber-950/60 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
                {currentGroup.badge}
              </span>
              <h2 className="text-2xl sm:text-3xl font-teacher font-bold chalk-text tracking-wide text-white">
                {currentFamily.title}
              </h2>
              <span className="text-sm font-mono text-emerald-300 font-bold bg-emerald-950/50 px-2.5 py-0.5 rounded-lg border border-emerald-400/30">
                Sound: {currentFamily.exampleSound}
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1 font-teacher">
              {currentFamily.descriptionEs}
            </p>
          </div>

          {/* Word Family Selector for this group */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-amber-200 uppercase tracking-wider">
              Family:
            </span>
            {currentGroup.families.map((fam) => {
              const isSelected = fam.id === currentFamily.id;
              return (
                <button
                  key={fam.id}
                  onClick={() => onSelectFamilyId(fam.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold font-teacher transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-400 text-slate-900 shadow-md font-extrabold ring-2 ring-white'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  }`}
                >
                  {fam.pattern}
                </button>
              );
            })}
          </div>
        </div>

        {/* INTERACTIVE SOUND BLENDING LAB (Magic Blackboard) */}
        <div className="bg-emerald-950/60 border-2 border-emerald-400/40 rounded-2xl p-4 sm:p-5 mb-8 backdrop-blur-xs">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
              <h3 className="font-teacher font-bold text-sm sm:text-base text-amber-300">
                Magic Blackboard: Blend the First Sound + Family!
              </h3>
            </div>
            <span className="text-xs text-slate-300 font-medium hidden sm:inline">
              Tap each part to hear its sound on its own
            </span>
          </div>

          {/* Sound Fusion Machine */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 py-3">
            {/* 1. Onset Sound Box */}
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                First Sound (Onset)
              </span>
              <button
                onClick={handlePlayOnset}
                className="w-16 h-16 rounded-2xl bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-teacher font-extrabold text-3xl shadow-lg border-2 border-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                title="Hear the first sound"
              >
                {selectedWordForBlend?.onset || '-'}
              </button>
              <span className="text-xs text-amber-200 mt-1 font-mono font-bold">
                {blendParts.onset.length ? blendParts.onset.map((s) => `/${s.symbol}/`).join(" ") : `/${selectedWordForBlend?.onset}/`}
              </span>
            </div>

            {/* Plus Operator */}
            <div className="text-3xl font-extrabold text-amber-300 font-teacher select-none">
              +
            </div>

            {/* 2. Rime Family Box */}
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Family (Rime)
              </span>
              <button
                onClick={handlePlayRime}
                className="px-5 h-16 rounded-2xl bg-gradient-to-b from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 text-white font-teacher font-extrabold text-3xl shadow-lg border-2 border-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                title="Hear the family sound"
              >
                {selectedWordForBlend?.rime || currentFamily.pattern}
              </button>
              <span className="text-xs text-sky-200 mt-1 font-mono font-bold">
                {currentFamily.exampleSound}
              </span>
            </div>

            {/* Equal Arrow */}
            <div className="text-2xl font-extrabold text-amber-300 select-none">
              <ArrowRight className="w-8 h-8" />
            </div>

            {/* 3. Combined Blended Result Box */}
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider mb-1">
                Whole Word!
              </span>
              <div
                className={`px-6 h-16 rounded-2xl bg-gradient-to-b from-emerald-500 to-teal-600 text-white font-teacher font-extrabold text-3xl shadow-lg border-2 border-white flex items-center gap-2 justify-center transition-all duration-300 ${
                  isBlending ? 'scale-115 ring-4 ring-amber-300 animate-pulse' : ''
                }`}
              >
                <span>{selectedWordForBlend?.emoji}</span>
                <span>{selectedWordForBlend?.word}</span>
              </div>
              <span className="text-xs text-emerald-200 mt-1 font-mono font-bold">
                {selectedWordForBlend?.phonetics}
              </span>
            </div>
          </div>

          {/* Action Trigger for Blend */}
          <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t border-white/10">
            <button
              onClick={handleTriggerBlend}
              disabled={isBlending}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-teacher font-extrabold text-sm shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-slate-900" />
              <span>{isBlending ? 'Blending sounds...' : 'Blend the Sounds and Listen!'}</span>
            </button>

            <button
              onClick={() => handlePlayWord(selectedWordForBlend, true)}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-teacher font-bold text-xs border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Listen slowly, sound by sound"
            >
              <Volume2 className="w-3.5 h-3.5 text-amber-300" />
              <span>Slow motion / Break it down</span>
            </button>
          </div>
        </div>

        {/* Word Cards Grid */}
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-teacher font-bold text-xl text-white chalk-text flex items-center gap-2">
              <span>Words in the {currentFamily.pattern} Family</span>
              <span className="text-xs font-mono bg-white/20 text-amber-200 px-2 py-0.5 rounded-full">
                {currentFamily.words.length} words
              </span>
            </h3>
            <p className="text-xs text-slate-300 font-teacher">
              Tap any word to put it on the blending board
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentFamily.words.map((item) => {
              const isSelected = selectedWordForBlend?.id === item.id;
              const mastery = masteryMap[item.id];
              const isPlaying = activePlayingWord === item.id;
              const isCached =
                cachedAudioKeys.has(`${teacherVoice}_${item.word.toLowerCase()}`) ||
                cachedAudioKeys.has(`word:${item.word.toLowerCase()}`) ||
                cachedAudioKeys.has(item.word.toLowerCase());

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedWordForBlend(item)}
                  className={`relative p-4 rounded-2xl transition-all duration-200 cursor-pointer border-2 text-left ${
                    isSelected
                      ? 'bg-amber-950/80 border-amber-400 shadow-lg ring-2 ring-amber-300/60 scale-[1.02]'
                      : 'bg-white/10 hover:bg-white/15 border-white/15 hover:border-white/30'
                  }`}
                >
                  {/* Top Word Row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-3xl filter drop-shadow">{item.emoji}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-teacher font-extrabold text-2xl text-white tracking-wide">
                            <span className="text-amber-400">{item.onset}</span>
                            <span className="text-sky-300">{item.rime}</span>
                          </span>
                          {isCached && (
                            <span
                              className="text-[9px] text-emerald-300 font-teacher font-bold flex items-center gap-0.5 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-400/40"
                              title="Audio saved in memory (no API use)"
                            >
                              💾 Cached
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-emerald-300 font-bold block">
                          {item.phonetics}
                        </span>
                      </div>
                    </div>

                    {/* Quick Pronounce Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayWord(item, false);
                      }}
                      className={`p-2.5 rounded-xl transition-all shadow cursor-pointer ${
                        isPlaying
                          ? 'bg-green-500 text-white animate-bounce'
                          : 'bg-amber-400 hover:bg-amber-300 text-slate-900 active:scale-95'
                      }`}
                      title="Hear the teacher say it"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Mastery badge */}
                  {mastery && mastery.timesCorrect > 0 && (
                    <div className="mb-2.5 flex items-center justify-end">
                      <span className="flex items-center gap-1 text-[10px] text-emerald-300 font-bold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        {mastery.timesCorrect}✓
                      </span>
                    </div>
                  )}

                  {/* Sample Sentence */}
                  {item.exampleSentence && (
                    <p className="text-xs text-slate-200 italic leading-snug line-clamp-2 mb-3">
                      "{item.exampleSentence}"
                    </p>
                  )}

                  {/* Action Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayWord(item, true);
                      }}
                      className="text-[11px] font-teacher font-bold text-sky-300 hover:text-sky-200 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Break it down</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPracticeWordInVoice(item);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 text-white font-teacher font-bold text-[11px] flex items-center gap-1 shadow cursor-pointer transition-transform active:scale-95"
                      title="Microphone challenge"
                    >
                      <Mic className="w-3 h-3" />
                      <span>Say it with my voice!</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
