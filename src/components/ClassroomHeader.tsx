import React from 'react';
import {
  BookOpen,
  Mic,
  Sparkles,
  Gamepad2,
  Award,
  Volume2,
  VolumeX,
  Flame,
  Star,
  Users,
  Database,
  Zap, GraduationCap } from 'lucide-react';
import { UserStats } from '../types/phonics';
import { TEACHER_PROFILES } from './TeacherAvatar';

export type ActiveTab = 'curso' | 'pizarra' | 'micro' | 'lab' | 'juego' | 'premios';

interface ClassroomHeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  userStats: UserStats;
  onTeacherChange: (teacherId: 'spark' | 'maya' | 'owl') => void;
  onToggleSound: () => void;
  onOpenAudioCacheModal: () => void;
  cachedAudioCount: number;
}

export const ClassroomHeader: React.FC<ClassroomHeaderProps> = ({
  activeTab,
  onTabChange,
  userStats,
  onTeacherChange,
  onToggleSound,
  onOpenAudioCacheModal,
  cachedAudioCount,
}) => {
  const currentTeacher = TEACHER_PROFILES[userStats.selectedTeacher] || TEACHER_PROFILES.spark;

  const tabs = [
    {
      id: 'curso' as ActiveTab,
      label: 'Curso',
      badge: '42 Sorts',
      icon: GraduationCap,
      color: 'hover:bg-indigo-100 text-indigo-900',
      activeClass: 'bg-indigo-600 text-white shadow-md',
    },
    {
      id: 'pizarra' as ActiveTab,
      label: 'Pizarra de Sonidos',
      badge: 'Familias',
      icon: BookOpen,
      color: 'hover:bg-amber-100 text-amber-900',
      activeClass: 'bg-amber-500 text-white shadow-md',
    },
    {
      id: 'micro' as ActiveTab,
      label: 'Reto de Pronunciación',
      badge: 'Micrófono',
      icon: Mic,
      color: 'hover:bg-emerald-100 text-emerald-900',
      activeClass: 'bg-emerald-600 text-white shadow-md',
    },
    {
      id: 'lab' as ActiveTab,
      label: 'Laboratorio IA + Memory',
      badge: 'IndexedDB',
      icon: Sparkles,
      color: 'hover:bg-purple-100 text-purple-900',
      activeClass: 'bg-purple-600 text-white shadow-md',
    },
    {
      id: 'juego' as ActiveTab,
      label: 'Atrapa el Sonido',
      badge: 'Juego',
      icon: Gamepad2,
      color: 'hover:bg-sky-100 text-sky-900',
      activeClass: 'bg-sky-600 text-white shadow-md',
    },
    {
      id: 'premios' as ActiveTab,
      label: 'Álbum y Premios',
      badge: `${userStats.unlockedStickers.length} Trofeos`,
      icon: Award,
      color: 'hover:bg-rose-100 text-rose-900',
      activeClass: 'bg-rose-600 text-white shadow-md',
    },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b-2 border-amber-200 shadow-sm pt-[env(safe-area-inset-top)]">
      {/* Top Bar: Title & Gamification HUD */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        {/* Brand / Classroom Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-xl shadow-md text-white font-bold border-2 border-white">
            🏫
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-teacher font-extrabold text-slate-800 text-lg sm:text-xl tracking-tight">
                Phonics Teacher
              </h1>
              <span className="hidden sm:inline-block bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Grados 1º - 4º (7-11 años)
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium hidden sm:block">
              Aprende sonidos en inglés con tu profesor favorito y memoria IndexedDB
            </p>
          </div>
        </div>

        {/* Gamification Counters & Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Star Bank (Frasco de Estrellas) */}
          <div
            className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 px-3 py-1.5 rounded-2xl shadow-inner cursor-pointer hover:bg-amber-100 transition-colors"
            title="Estrellas acumuladas en tu frasco escolar"
            onClick={() => onTabChange('premios')}
          >
            <Star className="w-4 h-4 text-amber-500 fill-amber-400 animate-twinkle" />
            <span className="font-teacher font-bold text-amber-900 text-sm">
              {userStats.totalStars}
            </span>
          </div>

          {/* Daily Streak */}
          <div
            className="flex items-center gap-1.5 bg-orange-50 border border-orange-300 px-2.5 py-1.5 rounded-2xl shadow-inner"
            title="Racha de práctica diaria"
          >
            <Flame className="w-4 h-4 text-orange-500 fill-orange-400" />
            <span className="font-teacher font-bold text-orange-900 text-xs sm:text-sm">
              {userStats.currentStreak} d
            </span>
          </div>

          {/* Audio Cache & Quota Saver Button */}
          <button
            onClick={onOpenAudioCacheModal}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1.5 rounded-2xl text-xs font-bold font-teacher text-emerald-800 transition-colors cursor-pointer shadow-xs active:scale-95"
            title="Ver los audios publicados en GitHub"
          >
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Caché TTS</span>
            <span className="bg-emerald-200 text-emerald-900 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {cachedAudioCount}
            </span>
          </button>

          {/* Teacher Switcher Dropdown / Button */}
          <div className="relative group">
            <button
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 px-2.5 py-1.5 rounded-2xl text-xs font-bold font-teacher text-slate-700 transition-colors cursor-pointer"
              title="Cambiar de profesor"
            >
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>{currentTeacher.emoji} {currentTeacher.name.split(' ')[0]}</span>
            </button>
            <div className="absolute right-0 mt-1 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 hidden group-hover:block hover:block z-50">
              <p className="text-[11px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                Elige a tu Profesor:
              </p>
              {(Object.keys(TEACHER_PROFILES) as Array<keyof typeof TEACHER_PROFILES>).map((tKey) => {
                const prof = TEACHER_PROFILES[tKey];
                const isSelected = userStats.selectedTeacher === tKey;
                return (
                  <button
                    key={tKey}
                    onClick={() => onTeacherChange(tKey)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left text-xs font-teacher font-bold transition-all ${
                      isSelected
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="text-xl">{prof.emoji}</span>
                    <div>
                      <div className="leading-tight">{prof.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{prof.title}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            className={`p-2 rounded-2xl border transition-colors cursor-pointer ${
              userStats.soundEnabled
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                : 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100'
            }`}
            title={userStats.soundEnabled ? 'Silenciar sonidos' : 'Activar sonidos'}
          >
            {userStats.soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation Tabs (Playful School Desk Tabs) */}
      <div className="max-w-7xl mx-auto px-4 overflow-x-auto scrollbar-none pb-2">
        <nav className="flex items-center gap-2 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl font-teacher text-xs sm:text-sm font-bold transition-all duration-150 cursor-pointer ${
                  isActive ? tab.activeClass : `bg-white/80 border border-slate-200 ${tab.color}`
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : ''}`} />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
