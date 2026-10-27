import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, Star } from 'lucide-react';
import { COURSE_UNITS, WordSort } from '../data/course';
import { SortProgress, getCourseWord } from '../services/course';

interface CourseMapProps {
  progress: Record<string, SortProgress>;
  onOpenSort: (sort: WordSort) => void;
}

const MODE_LABEL: Record<WordSort['mode'], string> = {
  sort: 'Sort',
  quiz: 'Quick review',
  assessment: 'Assessment',
};

export const CourseMap: React.FC<CourseMapProps> = ({ progress, onOpenSort }) => {
  const firstPending = COURSE_UNITS.find((u) => u.sorts.some((s) => !progress[s.id]?.completed));
  const [openUnit, setOpenUnit] = useState<string>(firstPending?.id ?? COURSE_UNITS[0].id);
  const totalSorts = COURSE_UNITS.reduce((n, u) => n + u.sorts.length, 0);
  const doneSorts = Object.values(progress).filter((p) => p.completed).length;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl border-2 border-amber-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-teacher font-extrabold text-2xl text-slate-800">Phonics Course</h2>
            <p className="text-sm text-slate-500">Letter-Name Alphabetic Stage · 6 units · {totalSorts} sorts</p>
          </div>
          <div className="text-right shrink-0">
            <div className="font-teacher font-extrabold text-2xl text-amber-600">
              {doneSorts}/{totalSorts}
            </div>
            <div className="text-xs text-slate-500">completed</div>
          </div>
        </div>
        <div className="mt-3 h-2 bg-amber-100 rounded-full overflow-hidden">
          <div className="h-full bg-amber-500" style={{ width: `${(doneSorts / totalSorts) * 100}%` }} />
        </div>
      </div>

      {COURSE_UNITS.map((unit) => {
        const done = unit.sorts.filter((s) => progress[s.id]?.completed).length;
        const isOpen = openUnit === unit.id;
        return (
          <div key={unit.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => setOpenUnit(isOpen ? '' : unit.id)}
              className={`w-full flex items-center gap-3 p-4 text-left bg-gradient-to-r ${unit.color} text-white`}
            >
              <span className="text-3xl">{unit.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold uppercase tracking-wide opacity-90">
                  Unit {unit.number} · Sorts {unit.sorts[0].number}–{unit.sorts[unit.sorts.length - 1].number}
                </div>
                <div className="font-teacher font-extrabold text-lg leading-tight">{unit.title}</div>
                <div className="text-xs opacity-90">{unit.descriptionEs}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-extrabold">
                  {done}/{unit.sorts.length}
                </div>
                <ChevronDown className={`w-5 h-5 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {isOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3">
                {unit.sorts.map((sort) => {
                  const p = progress[sort.id];
                  const preview = sort.categories.slice(0, 5).map((c) => getCourseWord(c.keyWord).emoji).join(' ');
                  return (
                    <button
                      key={sort.id}
                      onClick={() => onOpenSort(sort)}
                      className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-colors ${
                        p?.completed ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100 hover:border-amber-300'
                      }`}
                    >
                      <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-900 text-white flex items-center justify-center font-extrabold">
                        {sort.number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 truncate">{sort.title}</div>
                        <div className="text-xs text-slate-500 truncate">
                          {MODE_LABEL[sort.mode]}
                          {sort.mode === 'sort' && ` · ${sort.cards.length} cards · ${preview}`}
                        </div>
                      </div>
                      {p?.completed ? (
                        <div className="flex items-center gap-0.5 shrink-0">
                          {[1, 2, 3].map((n) => (
                            <Star key={n} className={`w-4 h-4 ${n <= p.stars ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                          ))}
                          {p.bestScore !== undefined && (
                            <span className="ml-1 text-xs font-bold text-emerald-700">{Math.round(p.bestScore * 100)}%</span>
                          )}
                        </div>
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-slate-200 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
