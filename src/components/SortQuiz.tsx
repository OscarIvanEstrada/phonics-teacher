import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RotateCcw, Volume2 } from 'lucide-react';
import { WordSort } from '../data/course';
import { audioService } from '../services/audioService';
import {
  ASSESSMENT_PASS_RATIO,
  AssessmentStep,
  buildConsonantQuiz,
  buildFinalAssessment,
  getCourseWord,
} from '../services/course';

interface SortQuizProps {
  sort: WordSort; // mode 'quiz' (Sort 14) or 'assessment' (Sort 42)
  teacherVoice: 'Kore' | 'Puck' | 'Zephyr';
  onBack: () => void;
  onComplete: (stars: number, score: number) => void;
  onNext?: () => void;
}

interface Question {
  word: string;
  prompt: string;
  answer: string;
  options: string[];
  /** Assessment: show the word with the asked part hidden */
  masked?: string;
}

const STEP_PROMPTS: Record<AssessmentStep, string> = {
  initial: '¿Con qué sonido empieza?',
  vowel: '¿Qué vocal corta tiene en el medio?',
  final: '¿Con qué sonido termina?',
};

function buildQuestions(sort: WordSort): Question[] {
  if (sort.mode === 'quiz') {
    return buildConsonantQuiz().map((q) => ({ ...q, prompt: '¿Con qué sonido empieza?' }));
  }
  return buildFinalAssessment().flatMap((item) =>
    (['initial', 'vowel', 'final'] as AssessmentStep[]).map((step) => ({
      word: item.word,
      prompt: STEP_PROMPTS[step],
      answer: item.parts[step],
      options: item.options[step],
      masked: (['initial', 'vowel', 'final'] as AssessmentStep[])
        .map((s) => (s === step ? '_'.repeat(item.parts[s].length) : item.parts[s]))
        .join(''),
    }))
  );
}

export const SortQuiz: React.FC<SortQuizProps> = ({ sort, teacherVoice, onBack, onComplete, onNext }) => {
  const [round, setRound] = useState(0);
  const questions = useMemo(() => buildQuestions(sort), [sort.id, round]);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState<{ choice: string; right: boolean } | null>(null);
  const isAssessment = sort.mode === 'assessment';
  const current = questions[index];
  const finished = index >= questions.length;
  const score = questions.length ? correct / questions.length : 0;
  const passed = score >= ASSESSMENT_PASS_RATIO;
  const stars = score >= 0.95 ? 3 : score >= ASSESSMENT_PASS_RATIO ? 2 : 1;

  useEffect(() => {
    setIndex(0);
    setCorrect(0);
    setFeedback(null);
  }, [sort.id, round]);

  // Say the word when a new word appears (the assessment asks 3 questions per word)
  const previousWord = index > 0 ? questions[index - 1]?.word : null;
  useEffect(() => {
    if (current && current.word !== previousWord) audioService.speakPhonicsWord(current.word, { voiceName: teacherVoice });
  }, [index, round]);

  useEffect(() => {
    if (finished && questions.length > 0) {
      if (!isAssessment || passed) audioService.playCelebrationFanfare();
      onComplete(stars, score);
    }
  }, [finished]);

  const choose = (option: string) => {
    if (feedback) return;
    const right = option === current.answer;
    setFeedback({ choice: option, right });
    if (right) {
      setCorrect((c) => c + 1);
      audioService.playCorrectSound();
    } else {
      audioService.speakPhonicsWord(current.word, { voiceName: teacherVoice, slow: true });
    }
    setTimeout(() => {
      setFeedback(null);
      setIndex((i) => i + 1);
    }, right ? 700 : 1600);
  };

  const word = current ? getCourseWord(current.word) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-700">
          <ArrowLeft className="w-4 h-4" /> Curso
        </button>
        <div className="text-right">
          <div className="font-teacher font-extrabold text-lg text-slate-800 leading-tight">
            Sort {sort.number}: {sort.title}
          </div>
          <div className="text-xs text-slate-500">{sort.focusEs}</div>
        </div>
      </div>

      {!finished && word ? (
        <div className="bg-slate-900 rounded-3xl p-5 text-center text-white space-y-4">
          <div className="text-xs text-slate-400">
            Pregunta {index + 1} de {questions.length}
            <div className="mt-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400" style={{ width: `${(index / questions.length) * 100}%` }} />
            </div>
          </div>
          <button
            onClick={() => audioService.speakPhonicsWord(word.word, { voiceName: teacherVoice })}
            className="mx-auto flex flex-col items-center gap-1"
          >
            <span className="text-6xl">{word.emoji}</span>
            {current.masked && <span className="font-teacher font-extrabold text-4xl tracking-widest">{current.masked}</span>}
            <span className="flex items-center gap-1 text-amber-300 text-sm font-bold">
              <Volume2 className="w-4 h-4" /> Escuchar
            </span>
          </button>
          <div className="font-teacher font-bold text-lg">{current.prompt}</div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {current.options.map((option) => {
              const state =
                feedback && option === current.answer
                  ? 'bg-emerald-500 text-white'
                  : feedback?.choice === option
                  ? 'bg-red-500 text-white'
                  : 'bg-white text-slate-900';
              return (
                <button
                  key={option}
                  onClick={() => choose(option)}
                  className={`py-3 rounded-2xl font-teacher font-extrabold text-2xl transition-colors ${state}`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={`${!isAssessment || passed ? 'bg-emerald-600' : 'bg-amber-600'} rounded-3xl p-5 text-center text-white space-y-3`}>
          <div className="font-teacher font-extrabold text-2xl">
            {isAssessment ? (passed ? '🎓 ¡Etapa superada!' : 'Casi lo logras') : '¡Repaso terminado!'}
          </div>
          <div className="text-4xl font-extrabold">{Math.round(score * 100)}%</div>
          <div className="text-sm text-white/90">
            {correct} de {questions.length} respuestas correctas
            {isAssessment &&
              (passed
                ? '. Dominas sonido inicial, vocal corta y sonido final: listo para vocales largas (CVCe).'
                : `. Necesitas ${Math.round(ASSESSMENT_PASS_RATIO * 100)}% para pasar. Repasa la Unidad 6 y vuelve a intentarlo.`)}
          </div>
          <div className="flex justify-center gap-2">
            <button onClick={() => setRound((r) => r + 1)} className="flex items-center gap-1 px-4 py-2 rounded-full bg-white/20 font-bold text-sm">
              <RotateCcw className="w-4 h-4" /> Repetir
            </button>
            {onNext && (
              <button onClick={onNext} className="px-4 py-2 rounded-full bg-white text-emerald-700 font-bold text-sm">
                Siguiente →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
