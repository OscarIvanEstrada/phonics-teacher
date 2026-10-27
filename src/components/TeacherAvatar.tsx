import React from 'react';
import { Volume2, Sparkles, Smile, Award } from 'lucide-react';
import { audioService } from '../services/audioService';

export type TeacherMood = 'greeting' | 'teaching' | 'listening' | 'celebrating' | 'thinking' | 'encouraging' | 'speaking';

interface TeacherAvatarProps {
  teacherId: 'spark' | 'maya' | 'owl';
  mood?: TeacherMood;
  speechText?: string;
  onSpeak?: () => void;
  compact?: boolean;
}

export const TEACHER_PROFILES = {
  spark: {
    id: 'spark' as const,
    name: 'Professor Spark',
    title: 'Sound Scientist',
    emoji: '👨‍🏫',
    avatarBg: 'bg-emerald-500',
    borderColor: 'border-emerald-300',
    voice: 'Puck' as const,
    catchphrase: 'Let us discover the magic of sounds together!',
  },
  maya: {
    id: 'maya' as const,
    name: 'Teacher Maya',
    title: 'Pronunciation Teacher',
    emoji: '👩‍🏫',
    avatarBg: 'bg-violet-500',
    borderColor: 'border-violet-300',
    voice: 'Kore' as const,
    catchphrase: 'Speak up and smile, you are a great reader!',
  },
  owl: {
    id: 'owl' as const,
    name: 'Mr. Wise Owl',
    title: 'Head of the Academy',
    emoji: '🦉',
    avatarBg: 'bg-amber-600',
    borderColor: 'border-amber-300',
    voice: 'Zephyr' as const,
    catchphrase: 'Wisdom is built sound by sound!',
  },
};

export const TeacherAvatar: React.FC<TeacherAvatarProps> = ({
  teacherId = 'spark',
  mood = 'teaching',
  speechText = 'Welcome to class! Let us practice English phonics!',
  onSpeak,
  compact = false,
}) => {
  const teacher = TEACHER_PROFILES[teacherId] || TEACHER_PROFILES.spark;

  const handleSpeech = () => {
    if (onSpeak) {
      onSpeak();
    } else {
      audioService.speakPhonicsWord(speechText, {
        voiceName: teacher.voice,
      });
    }
  };

  const getMoodBadge = () => {
    switch (mood) {
      case 'speaking':
        return (
          <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold animate-pulse">
            <Volume2 className="w-3 h-3 text-emerald-600" /> Speaking...
          </span>
        );
      case 'listening':
        return (
          <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500"></span> Listening to you!
          </span>
        );
      case 'celebrating':
        return (
          <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
            <Sparkles className="w-3 h-3 text-amber-500" /> Awesome!
          </span>
        );
      case 'thinking':
        return (
          <span className="inline-flex items-center gap-1 text-xs bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-bold">
            💡 Thinking with AI...
          </span>
        );
      case 'encouraging':
        return (
          <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
            <Award className="w-3 h-3 text-emerald-600" /> You can do it!
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
            <Smile className="w-3 h-3 text-amber-600" /> In class
          </span>
        );
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 bg-white/90 backdrop-blur-sm border-2 border-amber-200 rounded-2xl px-3 py-2 shadow-sm">
        <div className={`relative w-11 h-11 rounded-2xl ${teacher.avatarBg} flex items-center justify-center text-2xl shadow-inner border-2 border-white`}>
          <span>{teacher.emoji}</span>
          {mood === 'speaking' && (
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white animate-ping" />
          )}
        </div>
        <div className="text-left">
          <div className="flex items-center gap-1.5">
            <span className="font-teacher font-bold text-slate-800 text-sm">{teacher.name}</span>
            {getMoodBadge()}
          </div>
          <p className="text-xs text-slate-500 font-medium truncate max-w-[200px] sm:max-w-xs">{speechText}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50/80 rounded-3xl border-2 border-amber-200 shadow-md">
      {/* Teacher Character Body / Frame */}
      <div className="relative group shrink-0">
        <div
          className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl ${teacher.avatarBg} flex items-center justify-center text-4xl sm:text-5xl shadow-lg border-4 border-white transition-transform hover:scale-105 duration-200`}
        >
          <span className={`${mood === 'celebrating' ? 'animate-bounce' : 'animate-float'}`}>
            {teacher.emoji}
          </span>
        </div>

        {/* Pointer / Chalk Badge */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-900 text-amber-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border border-amber-400/40 shadow-sm whitespace-nowrap">
          {teacher.name}
        </div>
      </div>

      {/* Teacher Speech Bubble */}
      <div className="flex-1 w-full text-center sm:text-left bg-white rounded-2xl p-4 border border-amber-100 shadow-sm relative">
        {/* Triangle pointer for speech bubble */}
        <div className="hidden sm:block absolute -left-2 top-6 w-4 h-4 bg-white border-l border-b border-amber-100 transform rotate-45" />

        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-teacher font-bold text-amber-900 text-base">{teacher.name}</span>
            <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md font-semibold">
              {teacher.title}
            </span>
          </div>
          {getMoodBadge()}
        </div>

        {/* English sentence */}
        <div className="my-1.5 space-y-1">
          <p className="text-slate-800 font-bold text-base sm:text-lg tracking-wide font-teacher leading-snug">
            "{speechText}"
          </p>
        </div>

        {/* Hear Teacher Audio Button */}
        <div className="mt-2.5 flex items-center justify-center sm:justify-start gap-2">
          <button
            onClick={handleSpeech}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-teacher font-bold text-xs shadow transition-all duration-150 cursor-pointer"
            title="Hear the teacher read this out loud"
          >
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
            <span>Hear the Teacher</span>
          </button>
          <span className="text-[11px] text-amber-800/70 font-semibold hidden md:inline">
            Kokoro & Chatterbox voices
          </span>
        </div>
      </div>
    </div>
  );
};
