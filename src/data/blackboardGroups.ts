import { PhonicsWord, WordFamily, WordFamilyGroup } from '../types/phonics';
import { ALL_SORTS, COURSE_UNITS, ODDBALL_ID, WordSort } from './course';
import { PHONICS_GROUPS } from './phonicsCurriculum';
import { getCourseWord } from '../services/course';

/**
 * Groups shown on the Sound Blackboard: one group per course unit with one "family" per sort,
 * followed by the original short-vowel families.
 */

// Reuse the hand-written example sentences of the original curriculum when the word appears there
const SENTENCES = new Map(
  PHONICS_GROUPS.flatMap((g) => g.families.flatMap((f) => f.words)).map((w) => [w.word, w] as const)
);

/** Onset = letters before the first vowel ("qu" and an initial "y" count as onset): "truck" → tr + -uck, "yarn" → y + -arn. */
function splitSpelling(word: string): { onset: string; rime: string } {
  const match = /^(y?(?:qu|[^aeiouy])*)(.*)$/.exec(word);
  const onset = match?.[1] ?? '';
  const rime = match?.[2] ?? word;
  return onset && rime ? { onset, rime: `-${rime}` } : { onset: word, rime: '' };
}

function toPhonicsWord(sort: WordSort, word: string): PhonicsWord {
  const info = getCourseWord(word);
  const original = SENTENCES.get(word);
  return {
    id: `sort${sort.number}-${word}`,
    word,
    ...splitSpelling(word),
    phonetics: info.phonetics,
    meaningEs: info.meaningEs,
    exampleSentence: original?.exampleSentence ?? '',
    exampleSentenceEs: original?.exampleSentenceEs,
    emoji: info.emoji,
  };
}

/** Words a sort shows on the board; the review/assessment sorts list the key words they cover. */
function sortWords(sort: WordSort): string[] {
  if (sort.mode === 'quiz') {
    return ALL_SORTS.filter((s) => s.number <= 5).flatMap((s) => s.categories.map((c) => c.keyWord));
  }
  if (sort.mode === 'assessment') {
    return ALL_SORTS.filter((s) => s.unitId >= 'unit-3' && s.mode === 'sort').flatMap((s) =>
      s.categories.filter((c) => c.id !== ODDBALL_ID).map((c) => c.keyWord)
    );
  }
  return sort.cards.map((c) => c.word);
}

function sortToFamily(sort: WordSort): WordFamily {
  const words = [...new Set(sortWords(sort))];
  return {
    id: sort.id,
    pattern: `Sort ${sort.number}`,
    title: `Sort ${sort.number}: ${sort.title}`,
    vowelType: 'advanced',
    descriptionEs: sort.focusEs,
    exampleSound: sort.categories.filter((c) => c.sound).map((c) => c.sound).join(' ') || 'repaso',
    words: words.map((w) => toPhonicsWord(sort, w)),
  };
}

const COURSE_GROUPS: WordFamilyGroup[] = COURSE_UNITS.map((unit) => ({
  id: `course-${unit.id}`,
  title: `U${unit.number}. ${unit.title}`,
  subtitleEs: unit.descriptionEs,
  description: unit.descriptionEs,
  badge: unit.emoji,
  color: unit.color,
  families: unit.sorts.map(sortToFamily),
}));

export const BLACKBOARD_GROUPS: WordFamilyGroup[] = [...COURSE_GROUPS, ...PHONICS_GROUPS];
