export interface PhonicsWord {
  id: string;
  word: string;
  onset: string;
  rime: string;
  phonetics: string; // e.g. "/k/ /æ/ /t/"
  meaningEs: string; // Spanish translation for kids
  exampleSentence: string;
  exampleSentenceEs?: string;
  emoji: string;
  isAiGenerated?: boolean;
  timesPracticed?: number;
  timesCorrect?: number;
  starsEarned?: number;
}

export interface WordFamily {
  id: string;
  pattern: string; // e.g. "-at", "-in"
  title: string;
  vowelType: 'short-a' | 'short-e' | 'short-i' | 'short-o' | 'short-u' | 'short-mixed' | 'advanced';
  descriptionEs: string;
  exampleSound: string; // e.g. "sonido corto de la A con T"
  words: PhonicsWord[];
}

export interface WordFamilyGroup {
  id: string;
  title: string;
  subtitleEs: string;
  description: string;
  badge: string;
  color: string;
  families: WordFamily[];
}

export interface StoredGeneratedWord extends PhonicsWord {
  familyId: string;
  pattern: string;
  createdAt: number;
}

export interface UserStats {
  totalStars: number;
  totalGems: number;
  currentStreak: number;
  lastPracticeDate: string;
  wordsMastered: number;
  selectedTeacher: 'spark' | 'maya' | 'owl';
  soundEnabled: boolean;
  unlockedStickers: string[];
}

export interface Sticker {
  id: string;
  name: string;
  nameEs: string;
  emoji: string;
  descriptionEs: string;
  requiredStars: number;
  category: 'animals' | 'space' | 'magic' | 'school';
}
