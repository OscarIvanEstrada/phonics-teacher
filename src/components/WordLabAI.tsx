import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Database,
  Volume2,
  Trash2,
  RefreshCw,
  PlusCircle,
  Award,
  Layers,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PHONICS_GROUPS } from '../data/phonicsCurriculum';
import { PhonicsWord, StoredGeneratedWord, WordFamily } from '../types/phonics';
import {
  getAllGeneratedWords,
  saveGeneratedWords,
  deleteGeneratedWord,
  clearAllGeneratedWords,
  getAllKnownWordsForExclusion,
} from '../services/indexedDb';
import { audioService } from '../services/audioService';

interface WordLabAIProps {
  onStarsEarned: (count: number) => void;
  teacherVoice: 'Kore' | 'Puck' | 'Zephyr';
  onPracticeInVoice: (word: PhonicsWord) => void;
}

export const WordLabAI: React.FC<WordLabAIProps> = ({
  onStarsEarned,
  teacherVoice,
  onPracticeInVoice,
}) => {
  // Flatten all families for quick selection
  const allFamilies: WordFamily[] = PHONICS_GROUPS.flatMap((g) => g.families);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>(allFamilies[0].id);

  const selectedFamily = allFamilies.find((f) => f.id === selectedFamilyId) || allFamilies[0];

  const [storedWords, setStoredWords] = useState<StoredGeneratedWord[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recentlyGenerated, setRecentlyGenerated] = useState<string[]>([]);
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);

  // Load words from IndexedDB on mount & family change
  const loadStoredWords = async () => {
    try {
      const allWords = await getAllGeneratedWords();
      setStoredWords(allWords);
    } catch (err) {
      console.warn('Failed to load from IndexedDB:', err);
    }
  };

  useEffect(() => {
    loadStoredWords();
  }, []);

  const familyGeneratedWords = storedWords.filter(
    (w) => w.familyId === selectedFamily.id || w.pattern === selectedFamily.pattern
  );

  const handleGenerateNewWords = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setRecentlyGenerated([]);
    audioService.playChalkSound();

    try {
      // 1. Collect all known words from both curriculum and IndexedDB
      const knownFromDB = await getAllKnownWordsForExclusion();
      const knownFromCurriculum = selectedFamily.words.map((w) => w.word.toLowerCase());
      const allExclude = Array.from(new Set([...knownFromDB, ...knownFromCurriculum]));

      // 2. Call server endpoint powered by Gemini
      const response = await fetch('/api/generate-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyId: selectedFamily.id,
          pattern: selectedFamily.pattern,
          familyTitle: selectedFamily.title,
          excludeWords: allExclude,
          count: 4,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Could not make new words');
      }

      const data = await response.json();
      const rawWords = data.words || [];

      if (!rawWords.length) {
        throw new Error('The AI did not find new words for this pattern.');
      }

      // 3. Format and store in IndexedDB
      const formattedToStore: StoredGeneratedWord[] = rawWords.map((item: any) => ({
        id: `ai-${Date.now()}-${item.word}`,
        word: item.word.toLowerCase().trim(),
        onset: item.onset || item.word.slice(0, 1),
        rime: item.rime || selectedFamily.pattern,
        phonetics: item.phonetics || `/${item.word}/`,
        meaningEs: item.meaningEs || '',
        exampleSentence: item.exampleSentence || `Look at that ${item.word}!`,
        exampleSentenceEs: item.exampleSentenceEs || '',
        emoji: item.emoji || '✨',
        familyId: selectedFamily.id,
        pattern: selectedFamily.pattern,
        isAiGenerated: true,
        createdAt: Date.now(),
      }));

      // Persist in IndexedDB!
      await saveGeneratedWords(formattedToStore);

      // Refresh local state from IndexedDB
      await loadStoredWords();

      // Track recently generated IDs for highlight
      setRecentlyGenerated(formattedToStore.map((w) => w.id));

      // Reward student!
      onStarsEarned(5);
      audioService.playCelebrationFanfare();
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 },
      });

      // Speak confirmation
      audioService.speakPhonicsWord(
        `Great job! I just created ${formattedToStore.length} brand new words for you!`,
        { voiceName: teacherVoice }
      );
    } catch (err: any) {
      console.error(err);
      setErrorMsg(
        err.message ||
          'Something went wrong while making words. Check your connection and try again.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteWord = async (word: string) => {
    try {
      await deleteGeneratedWord(word);
      audioService.playPopSound();
      await loadStoredWords();
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to delete all the AI words saved in memory?')) {
      await clearAllGeneratedWords();
      audioService.playPopSound();
      await loadStoredWords();
    }
  };

  const handlePlayWord = async (w: PhonicsWord) => {
    setActivePlayingId(w.id);
    try {
      await audioService.speakPhonicsWord(w.word, { voiceName: teacherVoice });
    } finally {
      setActivePlayingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Intro */}
      <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border-2 border-purple-400">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="bg-purple-900/80 border border-purple-300/40 text-amber-300 font-teacher text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-amber-400" />
                IndexedDB Persistent Memory
              </span>
              <span className="bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-teacher text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                Gemini 3.8 Flash AI
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-teacher font-extrabold tracking-wide">
              AI Word Lab & Memory
            </h2>
            <p className="text-sm text-purple-200 font-medium max-w-2xl mt-1">
              Want more words for your sound family? The teacher uses AI to
              make real English words and saves them in your browser's <strong>IndexedDB</strong>
              so you <strong>never get the same words twice</strong>.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2 bg-purple-900/60 p-3 rounded-2xl border border-purple-400/30">
            <div className="text-center">
              <div className="font-teacher font-extrabold text-2xl text-amber-300">
                {storedWords.length}
              </div>
              <div className="text-[11px] font-bold text-purple-200 uppercase tracking-wider">
                In IDB Memory
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Box: Choose Family & Generate */}
      <div className="bg-white rounded-3xl p-5 border-2 border-purple-200 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Family Picker */}
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 font-teacher">
              1. Pick a Sound Family to Explore:
            </label>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {allFamilies.map((fam) => {
                const isSelected = fam.id === selectedFamily.id;
                const countInDB = storedWords.filter((w) => w.familyId === fam.id).length;
                return (
                  <button
                    key={fam.id}
                    onClick={() => setSelectedFamilyId(fam.id)}
                    className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-teacher font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-300'
                        : 'bg-slate-100 hover:bg-purple-50 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <span>{fam.pattern}</span>
                    {countInDB > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected ? 'bg-purple-800 text-amber-300' : 'bg-purple-200 text-purple-800'
                      }`}>
                        +{countInDB}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generator Button */}
          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={handleGenerateNewWords}
              disabled={isGenerating}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-teacher font-extrabold text-sm sm:text-base shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>The teacher is making new words...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-300 animate-bounce" />
                  <span>Make New Words with AI! (+5 ⭐)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-2xl text-xs sm:text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Generated Words for this family from IndexedDB */}
      <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-md">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-teacher font-bold text-xl text-slate-800 flex items-center gap-2">
              <span>Words Saved in IndexedDB ({selectedFamily.pattern})</span>
              <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                {familyGeneratedWords.length} created
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              These words are saved on your device so new lists never repeat them.
            </p>
          </div>

          {storedWords.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs font-teacher font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
              title="Delete all AI words saved in IndexedDB"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear IDB memory</span>
            </button>
          )}
        </div>

        {familyGeneratedWords.length === 0 ? (
          <div className="text-center py-10 px-4 bg-purple-50/50 rounded-2xl border-2 border-dashed border-purple-200">
            <div className="text-4xl mb-2">🧪✨</div>
            <h4 className="font-teacher font-bold text-slate-700 text-base mb-1">
              You have not made any words for the {selectedFamily.pattern} family yet
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
              Press the purple button above. The teacher will ask Gemini for real words
              that rhyme with {selectedFamily.pattern} and save them in your IndexedDB memory.
            </p>
            <button
              onClick={handleGenerateNewWords}
              disabled={isGenerating}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-teacher font-bold text-xs shadow inline-flex items-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Make my first list</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {familyGeneratedWords.map((item) => {
              const isRecent = recentlyGenerated.includes(item.id);
              const isPlaying = activePlayingId === item.id;
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border-2 transition-all relative ${
                    isRecent
                      ? 'bg-purple-50 border-purple-400 shadow-md ring-2 ring-purple-300 animate-pulse'
                      : 'bg-slate-50 hover:bg-purple-50/40 border-slate-200'
                  }`}
                >
                  {/* Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1 text-[10px] bg-purple-100 text-purple-700 font-teacher font-bold px-2 py-0.5 rounded-md border border-purple-200">
                      <Sparkles className="w-3 h-3 text-purple-500" /> AI + IndexedDB
                    </span>
                    <button
                      onClick={() => handleDeleteWord(item.word)}
                      className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                      title="Delete word from IndexedDB"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Word Content */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{item.emoji}</span>
                    <div>
                      <div className="font-teacher font-extrabold text-2xl text-slate-900 tracking-wide">
                        <span className="text-purple-600">{item.onset}</span>
                        <span className="text-amber-600">{item.rime}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-600">
                        {item.phonetics}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 italic leading-snug mb-3">
                    "{item.exampleSentence}"
                  </p>

                  {/* Controls */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                    <button
                      onClick={() => handlePlayWord(item)}
                      className={`px-3 py-1.5 rounded-xl font-teacher font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                        isPlaying
                          ? 'bg-purple-600 text-white'
                          : 'bg-amber-400 hover:bg-amber-300 text-slate-900'
                      }`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Listen</span>
                    </button>

                    <button
                      onClick={() => onPracticeInVoice(item)}
                      className="text-xs font-teacher font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                    >
                      Say it! →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
