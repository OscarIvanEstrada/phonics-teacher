import { ALL_SORTS, COURSE_UNITS, ODDBALL_ID, WordSort } from '../data/course';
import { WORD_BANK } from '../data/wordBank';

export interface CourseWord {
  word: string;
  /** Curriculum transcription, e.g. "/k/ /æ/ /t/" */
  phonetics: string;
  meaningEs: string;
  emoji: string;
}

export function getCourseWord(word: string): CourseWord {
  const entry = WORD_BANK[word];
  if (!entry) return { word, phonetics: '', meaningEs: '', emoji: '❓' };
  const [ipa, meaningEs, emoji] = entry;
  return { word, phonetics: ipa.split(' ').map((p) => `/${p}/`).join(' '), meaningEs, emoji };
}

/** Units 1–2 are picture sorts: showing the spelling would give the initial sound away. */
export function isPictureSort(sort: WordSort): boolean {
  return sort.unitId === 'unit-1' || sort.unitId === 'unit-2';
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function nextSort(sort: WordSort): WordSort | undefined {
  return ALL_SORTS[ALL_SORTS.findIndex((s) => s.id === sort.id) + 1];
}

// ==========================================
// Sort 14: initial consonant review quiz
// ==========================================

export interface QuizQuestion {
  word: string;
  /** Correct answer label, e.g. "B" */
  answer: string;
  options: string[];
}

/** One random picture per consonant from Sorts 1–5; pick the initial letter among 4. */
export function buildConsonantQuiz(): QuizQuestion[] {
  const sorts = ALL_SORTS.filter((s) => s.number >= 1 && s.number <= 5);
  const letters = sorts.flatMap((s) => s.categories.map((c) => c.label));
  const questions = sorts.flatMap((s) =>
    s.categories.map((c) => {
      const cards = s.cards.filter((card) => card.categoryId === c.id);
      const word = cards[Math.floor(Math.random() * cards.length)].word;
      const distractors = shuffle(letters.filter((l) => l !== c.label)).slice(0, 3);
      return { word, answer: c.label, options: shuffle([c.label, ...distractors]) };
    })
  );
  return shuffle(questions);
}

// ==========================================
// Sort 42: exit assessment
// ==========================================

export type AssessmentStep = 'initial' | 'vowel' | 'final';

export interface AssessmentItem {
  word: string;
  parts: Record<AssessmentStep, string>;
  options: Record<AssessmentStep, string[]>;
}

/** Split a one-vowel closed syllable into onset / vowel / coda spelling: "truck" → tr, u, ck. */
function splitClosedSyllable(word: string): Record<AssessmentStep, string> | null {
  const match = /^((?:qu|[^aeiou])+)([aeiou])([^aeiouy]+)$/.exec(word);
  if (!match) return null;
  return { initial: match[1], vowel: match[2], final: match[3] };
}

/** 15 words from Units 3–6 (families, digraph/double finals and plain CVC). */
export function buildFinalAssessment(count = 15): AssessmentItem[] {
  const pool = ALL_SORTS.filter((s) => s.unitId >= 'unit-3' && s.mode === 'sort')
    .flatMap((s) => s.cards.filter((c) => c.categoryId !== ODDBALL_ID).map((c) => c.word));
  const candidates = shuffle([...new Set(pool)])
    .map((word) => ({ word, parts: splitClosedSyllable(word) }))
    .filter((c): c is { word: string; parts: Record<AssessmentStep, string> } => c.parts !== null);

  const allInitials = [...new Set(candidates.map((c) => c.parts.initial))];
  const allFinals = [...new Set(candidates.map((c) => c.parts.final))];
  const optionsFor = (correct: string, pool: string[]) =>
    shuffle([correct, ...shuffle(pool.filter((p) => p !== correct)).slice(0, 3)]);

  return candidates.slice(0, count).map(({ word, parts }) => ({
    word,
    parts,
    options: {
      initial: optionsFor(parts.initial, allInitials),
      vowel: ['a', 'e', 'i', 'o', 'u'],
      final: optionsFor(parts.final, allFinals),
    },
  }));
}

export const ASSESSMENT_PASS_RATIO = 0.8;

// ==========================================
// Progress (per device)
// ==========================================

export interface SortProgress {
  completed: boolean;
  stars: number; // 1–3
  bestScore?: number; // 0–1, for quiz/assessment
  completedAt: number;
}

const PROGRESS_KEY = 'phonics.courseProgress';

export function getCourseProgress(): Record<string, SortProgress> {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

/** Save a result, keeping the best stars/score already earned. A failed assessment is recorded but not completed. */
export function saveSortResult(sortId: string, stars: number, score?: number): Record<string, SortProgress> {
  const progress = getCourseProgress();
  const previous = progress[sortId];
  const isAssessment = ALL_SORTS.find((s) => s.id === sortId)?.mode === 'assessment';
  const passed = !isAssessment || (score ?? 0) >= ASSESSMENT_PASS_RATIO;
  progress[sortId] = {
    completed: Boolean(previous?.completed) || passed,
    stars: Math.max(stars, previous?.stars ?? 0),
    bestScore: score === undefined ? previous?.bestScore : Math.max(score, previous?.bestScore ?? 0),
    completedAt: Date.now(),
  };
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch (e) {}
  return progress;
}

/** 3 stars with no more than 1 mistake per 6 cards, 2 with up to 1 per 3, else 1. */
export function starsForMistakes(mistakes: number, cards: number): number {
  if (mistakes <= Math.floor(cards / 6)) return 3;
  if (mistakes <= Math.ceil(cards / 3)) return 2;
  return 1;
}

export function unitOf(sort: WordSort) {
  return COURSE_UNITS.find((u) => u.id === sort.unitId)!;
}
