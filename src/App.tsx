import React, { useState, useEffect } from 'react';
import { ClassroomHeader, ActiveTab } from './components/ClassroomHeader';
import { TeacherAvatar, TeacherMood, TEACHER_PROFILES } from './components/TeacherAvatar';
import { PhonicsBlackboard } from './components/PhonicsBlackboard';
import { VoiceChallenge } from './components/VoiceChallenge';
import { WordLabAI } from './components/WordLabAI';
import { SoundCatchGame } from './components/SoundCatchGame';
import { RewardsAndStickers } from './components/RewardsAndStickers';
import { AudioCacheModal } from './components/AudioCacheModal';
import { VoiceSettingsModal } from './components/VoiceSettingsModal';
import { CourseMap } from './components/CourseMap';
import { WordSortActivity } from './components/WordSortActivity';
import { SortQuiz } from './components/SortQuiz';
import { WordSort } from './data/course';
import { getCourseProgress, nextSort, saveSortResult } from './services/course';
import { loadPublishedAudio, subscribePublishedAudio } from './services/publishedAudio';
import { wordFromPath } from './services/audioPaths';
import { IS_STATIC } from './config';
import { PhonicsWord, UserStats } from './types/phonics';
import { BLACKBOARD_GROUPS } from './data/blackboardGroups';
import {
  getUserStats,
  saveUserStats,
  getAllWordMastery,
  WordMasteryRecord,
} from './services/indexedDb';
import { audioService, AudioPlaybackEvent, TtsEngine, isNativeApp } from './services/audioService';

const ENGINE_LABELS: Record<TtsEngine, string> = {
  kokoro: 'Kokoro',
  chatterbox: 'Chatterbox',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('curso');
  const [openSort, setOpenSort] = useState<WordSort | null>(null);
  const [courseProgress, setCourseProgress] = useState(getCourseProgress());
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number>(0);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('sort-1');
  const [selectedWordForVoice, setSelectedWordForVoice] = useState<PhonicsWord | null>(null);

  const [isAudioCacheModalOpen, setIsAudioCacheModalOpen] = useState<boolean>(false);
  const [cachedAudioCount, setCachedAudioCount] = useState<number>(0);
  const [cachedAudioKeys, setCachedAudioKeys] = useState<Set<string>>(new Set());
  const [lastPlaybackEvent, setLastPlaybackEvent] = useState<AudioPlaybackEvent | null>(null);
  const [ttsEngine, setTtsEngine] = useState<TtsEngine>(audioService.getEngine());
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState<boolean>(false);

  const handleEngineChange = (engine: TtsEngine) => {
    audioService.setEngine(engine);
    setTtsEngine(engine);
  };

  const handleRegenerateLast = async () => {
    setIsRegenerating(true);
    try {
      await audioService.regenerateLast();
    } finally {
      setIsRegenerating(false);
    }
  };

  const [userStats, setUserStats] = useState<UserStats>({
    totalStars: 10,
    totalGems: 5,
    currentStreak: 1,
    lastPracticeDate: new Date().toISOString().split('T')[0],
    wordsMastered: 0,
    selectedTeacher: 'spark',
    soundEnabled: true,
    unlockedStickers: ['stk-owl'],
  });

  const [masteryMap, setMasteryMap] = useState<Record<string, WordMasteryRecord>>({});
  const [teacherMood, setTeacherMood] = useState<TeacherMood>('teaching');

  // Counter and "saved" markers come from the audio published on GitHub for the active engine
  useEffect(() => {
    loadPublishedAudio();
    return subscribePublishedAudio((paths) => {
      const forEngine = [...paths].filter((p) => p.startsWith(`audio/${ttsEngine}/`));
      setCachedAudioCount(forEngine.length);
      setCachedAudioKeys(
        new Set(
          forEngine
            .map(wordFromPath)
            .filter((w): w is NonNullable<ReturnType<typeof wordFromPath>> => w !== null)
            .map((w) => `${w.voice}_${w.word}`)
        )
      );
    });
  }, [ttsEngine]);

  // Load persistence from IndexedDB
  useEffect(() => {
    async function loadData() {
      try {
        const stats = await getUserStats();
        setUserStats(stats);
        audioService.setSoundEnabled(stats.soundEnabled);

        const mastery = await getAllWordMastery();
        setMasteryMap(mastery);
      } catch (err) {
        console.warn('Error loading initial data from IndexedDB:', err);
      }
    }
    loadData();

    // Subscribe to real-time audio playback events
    const unsubscribe = audioService.subscribePlayback((event) => {
      setLastPlaybackEvent(event);
    });

    return () => unsubscribe();
  }, []);

  const handleTeacherChange = async (teacherId: 'spark' | 'maya' | 'owl') => {
    const updated = { ...userStats, selectedTeacher: teacherId };
    setUserStats(updated);
    await saveUserStats(updated);
    audioService.playChalkSound();

    const prof = TEACHER_PROFILES[teacherId];
    audioService.speakPhonicsWord(`Hello! I am ${prof.name}. ${prof.catchphrase}`, {
      voiceName: prof.voice,
    });
  };

  const handleToggleSound = async () => {
    const newSound = !userStats.soundEnabled;
    const updated = { ...userStats, soundEnabled: newSound };
    setUserStats(updated);
    audioService.setSoundEnabled(newSound);
    await saveUserStats(updated);
  };

  const handleStarsEarned = async (count: number) => {
    const newTotal = userStats.totalStars + count;
    const updated = { ...userStats, totalStars: newTotal };
    setUserStats(updated);
    await saveUserStats(updated);

    // Refresh mastery map
    const mastery = await getAllWordMastery();
    setMasteryMap(mastery);

    setTeacherMood('celebrating');
    setTimeout(() => setTeacherMood('teaching'), 3500);
  };

  const handlePracticeWordInVoice = (word: PhonicsWord) => {
    setSelectedWordForVoice(word);
    setActiveTab('micro');
    setTeacherMood('listening');
  };

  const currentTeacher = TEACHER_PROFILES[userStats.selectedTeacher] || TEACHER_PROFILES.spark;

  // Dynamic teacher dialogue based on active tab
  const getTeacherDialogue = () => {
    switch (activeTab) {
      case 'micro':
        return {
          en: selectedWordForVoice
            ? `Pronounce "${selectedWordForVoice.word}". Focus on the ${selectedWordForVoice.rime} sound!`
            : 'Listen to my voice, then tap the microphone and speak aloud!',
        };
      case 'lab':
        return {
          en: 'Welcome to the AI Word Lab! We save every newly generated word in IndexedDB to never repeat words!',
        };
      case 'juego':
        return {
          en: 'Listen to the sound and catch the right word card as fast as you can!',
        };
      case 'premios':
        return {
          en: `You have collected ${userStats.totalStars} stars! Check your unlocked stickers and report card!`,
        };
      default:
        return {
          en: `Let us explore the ${BLACKBOARD_GROUPS[selectedGroupIndex]?.title.split('.')[1]?.trim() || 'short vowels'}! Blend onset and rime together.`,
        };
    }
  };

  const dialogue = getTeacherDialogue();

  return (
    <div className="min-h-screen bg-amber-50/60 flex flex-col">
      {/* Top Classroom Bar */}
      <ClassroomHeader
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          audioService.playChalkSound();
        }}
        userStats={userStats}
        onTeacherChange={handleTeacherChange}
        onToggleSound={handleToggleSound}
        onOpenAudioCacheModal={() => setIsAudioCacheModalOpen(true)}
        cachedAudioCount={cachedAudioCount}
      />

      {/* Floating Audio Playback Source Toast */}
      {lastPlaybackEvent && Date.now() - lastPlaybackEvent.timestamp < 3500 && (
        <div className="fixed bottom-5 right-5 z-40 bg-slate-900/95 text-white backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl border border-amber-300/40 flex items-center gap-3 animate-bounce">
          <span className="text-2xl">
            {lastPlaybackEvent.fromCache
              ? '💾'
              : lastPlaybackEvent.source === 'browser-fallback'
              ? '🗣️'
              : '✨'}
          </span>
          <div className="text-xs">
            <div className="font-teacher font-bold text-amber-300">
              {lastPlaybackEvent.fromCache
                ? 'Audio published on GitHub'
                : lastPlaybackEvent.source === 'browser-fallback'
                ? 'Browser voice (backup on)'
                : lastPlaybackEvent.source === 'ios-native'
                ? 'iPhone voice (on device)'
                : `Made with ${ENGINE_LABELS[lastPlaybackEvent.engine]} TTS`}
            </div>
            <div className="text-slate-300 font-medium">
              Word: "{lastPlaybackEvent.word}" •{' '}
              {lastPlaybackEvent.source === 'github'
                ? `GitHub · ${ENGINE_LABELS[lastPlaybackEvent.engine]}`
                : lastPlaybackEvent.source === 'kokoro'
                ? 'Kokoro TTS'
                : lastPlaybackEvent.source === 'chatterbox'
                ? 'Chatterbox Turbo'
                : lastPlaybackEvent.source === 'ios-native'
                ? 'Native iOS voice'
                : 'Local backup voice'}
            </div>
          </div>
        </div>
      )}

      {/* TTS Engine Selector & Regenerate Last Audio (web only; iOS uses on-device voices) */}
      {!isNativeApp && (
      <div className="fixed bottom-5 left-5 z-40 bg-white/95 backdrop-blur-md px-3 py-2.5 rounded-2xl shadow-xl border border-slate-200 flex flex-col gap-2 text-xs max-w-[calc(100vw-2.5rem)]">
        <div className="flex items-center gap-1">
          <span className="font-bold text-slate-600 mr-1">AI voice:</span>
          {(Object.keys(ENGINE_LABELS) as TtsEngine[]).map((engine) => (
            <button
              key={engine}
              onClick={() => handleEngineChange(engine)}
              className={`px-2.5 py-1 rounded-full font-bold transition-colors ${
                ttsEngine === engine ? 'bg-amber-400 text-slate-900' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {ENGINE_LABELS[engine]}
            </button>
          ))}
        </div>
        {lastPlaybackEvent && !IS_STATIC && (
          <button
            onClick={handleRegenerateLast}
            disabled={isRegenerating}
            title="If the audio sounds wrong, make it again and replace the saved one"
            className="px-2.5 py-1 rounded-full font-bold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 disabled:opacity-50 truncate"
          >
            {isRegenerating ? '⏳ Remaking…' : `🔄 Remake "${lastPlaybackEvent.word.slice(0, 24)}"`}
          </button>
        )}
      </div>
      )}

      {/* iOS: on-device voice picker */}
      {isNativeApp && (
        <button
          onClick={() => setIsVoiceSettingsOpen(true)}
          className="fixed left-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-full shadow-xl border border-slate-200 text-sm font-bold text-indigo-700"
        >
          🎙️ Voices
        </button>
      )}
      <VoiceSettingsModal
        isOpen={isVoiceSettingsOpen}
        onClose={() => setIsVoiceSettingsOpen(false)}
        onEngineChange={handleEngineChange}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full space-y-6">
        {/* Animated Teacher Persona & Speech Bubble */}
        <TeacherAvatar
          teacherId={userStats.selectedTeacher}
          mood={teacherMood}
          speechText={dialogue.en}
          onSpeak={() => {
            audioService.speakPhonicsWord(dialogue.en, {
              voiceName: currentTeacher.voice,
            });
          }}
        />

        {/* Course: units → word sorts */}
        {activeTab === 'curso' &&
          (openSort ? (
            React.createElement(openSort.mode === 'sort' ? WordSortActivity : SortQuiz, {
              key: openSort.id,
              sort: openSort,
              teacherVoice: currentTeacher.voice,
              onBack: () => setOpenSort(null),
              onComplete: (stars: number, score?: number) => {
                setCourseProgress(saveSortResult(openSort.id, stars, score));
                handleStarsEarned(stars);
              },
              onNext: nextSort(openSort) ? () => setOpenSort(nextSort(openSort)!) : undefined,
            })
          ) : (
            <CourseMap progress={courseProgress} onOpenSort={setOpenSort} />
          ))}

        {/* Tab 1: Phonics Blackboard (Curriculum Core) */}
        {activeTab === 'pizarra' && (
          <PhonicsBlackboard
            selectedGroupIndex={selectedGroupIndex}
            onSelectGroupIndex={setSelectedGroupIndex}
            selectedFamilyId={selectedFamilyId}
            onSelectFamilyId={setSelectedFamilyId}
            masteryMap={masteryMap}
            onPracticeWordInVoice={handlePracticeWordInVoice}
            teacherVoice={currentTeacher.voice}
            cachedAudioKeys={cachedAudioKeys}
          />
        )}

        {/* Tab 2: Pronunciation Challenge (Voice Match & Speech Recognition) */}
        {activeTab === 'micro' && (
          <VoiceChallenge
            currentWord={selectedWordForVoice}
            onSelectWord={setSelectedWordForVoice}
            onStarsEarned={handleStarsEarned}
            teacherVoice={currentTeacher.voice}
          />
        )}

        {/* Tab 3: AI Lab + IndexedDB (Prevents repetition) */}
        {activeTab === 'lab' && (
          <WordLabAI
            onStarsEarned={handleStarsEarned}
            teacherVoice={currentTeacher.voice}
            onPracticeInVoice={handlePracticeWordInVoice}
          />
        )}

        {/* Tab 4: Sound Catch (Game) */}
        {activeTab === 'juego' && (
          <SoundCatchGame
            onStarsEarned={handleStarsEarned}
            teacherVoice={currentTeacher.voice}
          />
        )}

        {/* Tab 5: Sticker Album & Report Card */}
        {activeTab === 'premios' && (
          <RewardsAndStickers
            userStats={userStats}
            masteryMap={masteryMap}
          />
        )}
      </main>

      {/* Audio Cache & Quota Saver Modal */}
      <AudioCacheModal
        isOpen={isAudioCacheModalOpen}
        onClose={() => setIsAudioCacheModalOpen(false)}
        lastEvent={lastPlaybackEvent}
      />

      {/* Classroom Desk Chalkboard Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 border-t-4 border-amber-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏫</span>
            <span className="font-teacher font-bold text-slate-200">
              Phonics Academy (Ages 7 - 11)
            </span>
            <span className="text-slate-500">•</span>
            <span>Kokoro & Chatterbox TTS · Audio on GitHub</span>
          </div>
          <div className="text-center sm:text-right text-slate-400">
            Short Vowel Families (-an, -in, -en, -un, Short A, E, I, O, U) · Grades 1 to 3
          </div>
        </div>
      </footer>
    </div>
  );
}
