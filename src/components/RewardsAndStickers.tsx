import React from 'react';
import {
  Award,
  Star,
  Lock,
  Sparkles,
  BookCheck,
  CheckCircle2,
  Calendar,
  Flame,
  Download,
} from 'lucide-react';
import { UserStats } from '../types/phonics';
import { STICKERS_CATALOG, PHONICS_GROUPS } from '../data/phonicsCurriculum';
import { WordMasteryRecord } from '../services/indexedDb';

interface RewardsAndStickersProps {
  userStats: UserStats;
  masteryMap: Record<string, WordMasteryRecord>;
}

export const RewardsAndStickers: React.FC<RewardsAndStickersProps> = ({
  userStats,
  masteryMap,
}) => {
  // Calculate group mastery %
  const groupStats = PHONICS_GROUPS.map((group) => {
    const allWords = group.families.flatMap((f) => f.words);
    const masteredWords = allWords.filter(
      (w) => masteryMap[w.id] && masteryMap[w.id].timesCorrect > 0
    );
    const percent = Math.round((masteredWords.length / allWords.length) * 100);
    return {
      group,
      total: allWords.length,
      mastered: masteredWords.length,
      percent,
    };
  });

  const totalCurriculumWords = PHONICS_GROUPS.flatMap((g) =>
    g.families.flatMap((f) => f.words)
  ).length;
  const totalMasteredWords = Object.values(masteryMap).filter((m) => m.timesCorrect > 0).length;
  const overallPercent = Math.min(100, Math.round((totalMasteredWords / totalCurriculumWords) * 100));

  return (
    <div className="space-y-6">
      {/* Top Banner: The Star Bank & Medal */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl border-4 border-amber-300 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            {/* Giant Star Jar Icon */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-amber-950/40 border-3 border-amber-300 flex items-center justify-center text-5xl shadow-inner shrink-0 animate-bounce">
              ⭐
            </div>
            <div>
              <span className="bg-amber-950/60 border border-amber-300/40 text-amber-200 text-xs font-teacher font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                School Star Jar
              </span>
              <h2 className="text-3xl sm:text-4xl font-teacher font-extrabold text-white mt-1">
                {userStats.totalStars} Gold Stars
              </h2>
              <p className="text-xs sm:text-sm text-amber-100 font-medium mt-1">
                Earn stars by listening to sounds, speaking into the microphone and making new words.
              </p>
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="grid grid-cols-2 gap-3 shrink-0 bg-amber-950/50 p-3 rounded-2xl border border-amber-300/40">
            <div className="text-center p-2">
              <span className="text-[10px] text-amber-200 uppercase font-bold block">
                Words Mastered
              </span>
              <span className="font-teacher font-extrabold text-2xl text-white">
                {totalMasteredWords}
              </span>
            </div>
            <div className="text-center p-2">
              <span className="text-[10px] text-orange-200 uppercase font-bold block flex items-center gap-1 justify-center">
                <Flame className="w-3 h-3 text-orange-400 fill-orange-400" /> Streak
              </span>
              <span className="font-teacher font-extrabold text-2xl text-white">
                {userStats.currentStreak} days
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Collectible Stickers Album */}
      <div className="bg-white rounded-3xl p-6 border-2 border-amber-200 shadow-md">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-teacher font-extrabold text-2xl text-slate-800 flex items-center gap-2">
              <span>Sticker & Trophy Album</span>
              <Sparkles className="w-5 h-5 text-amber-500" />
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Unlock magic badges by collecting stars in your daily activities.
            </p>
          </div>
          <span className="text-xs font-teacher font-bold text-amber-900 bg-amber-100 px-3 py-1 rounded-xl">
            {STICKERS_CATALOG.filter((s) => userStats.totalStars >= s.requiredStars).length} of {STICKERS_CATALOG.length} Unlocked
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {STICKERS_CATALOG.map((stk) => {
            const isUnlocked = userStats.totalStars >= stk.requiredStars;
            return (
              <div
                key={stk.id}
                className={`p-4 rounded-3xl border-3 text-center transition-all relative ${
                  isUnlocked
                    ? 'bg-gradient-to-b from-amber-50 to-orange-50/70 border-amber-300 shadow-md hover:scale-105'
                    : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                <div className="relative inline-block mb-2">
                  <div className={`text-5xl filter ${isUnlocked ? 'drop-shadow' : 'grayscale'}`}>
                    {stk.emoji}
                  </div>
                  {!isUnlocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 rounded-full">
                      <Lock className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>

                <h4 className="font-teacher font-extrabold text-sm text-slate-800">
                  {stk.name}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium mt-1 leading-tight">
                  {stk.descriptionEs}
                </p>

                <div className="mt-3 pt-2 border-t border-slate-200/80">
                  {isUnlocked ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-teacher font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Got it!
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-teacher font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
                      You need {stk.requiredStars} ⭐
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phonics Report Card / School Report */}
      <div className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-md">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-teacher font-extrabold text-2xl text-slate-800 flex items-center gap-2">
              <BookCheck className="w-6 h-6 text-emerald-600" />
              <span>Phonics Report Card</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Progress in short vowel families and advanced groups for grades 1 to 3.
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-300 px-3.5 py-1.5 rounded-2xl text-emerald-900 font-teacher font-extrabold text-sm">
            Overall Mastery: {overallPercent}%
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupStats.map(({ group, total, mastered, percent }) => (
            <div
              key={group.id}
              className="p-4 rounded-2xl border-2 border-slate-100 bg-slate-50/70 hover:bg-white transition-all space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-teacher font-bold text-sm text-slate-800">
                  {group.title}
                </span>
                <span className="text-xs font-mono font-bold text-slate-600">
                  {mastered}/{total} words ({percent}%)
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {group.families.map((f) => (
                  <span
                    key={f.id}
                    className="text-[10px] font-teacher font-bold bg-white text-slate-600 px-2 py-0.5 rounded-md border border-slate-200"
                  >
                    {f.pattern}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
