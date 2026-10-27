import { registerPlugin } from '@capacitor/core';

// Bridge to ios/App/App/NativeTTSPlugin.swift (AVSpeechSynthesizer, on-device)
export interface NativeVoice {
  id: string;
  name: string;
  language: string;
  quality: 'premium' | 'enhanced' | 'default';
  gender: 'male' | 'female' | 'unspecified';
  novelty: boolean;
}

interface SpeechOptions {
  text: string;
  voiceId?: string;
  language?: string;
  rate?: number;
  pitch?: number;
}

interface NativeTTSPlugin {
  getVoices(): Promise<{ voices: NativeVoice[] }>;
  synthesize(options: SpeechOptions): Promise<{ audioBase64: string; mimeType: string }>;
  speak(options: SpeechOptions): Promise<void>;
  stop(): Promise<void>;
}

export const NativeTTS = registerPlugin<NativeTTSPlugin>('NativeTTS');

export type TeacherVoiceKey = 'Kore' | 'Puck' | 'Zephyr';

// AVSpeechUtterance rate: 0.5 is the system default speaking speed
export const NATIVE_RATE = { normal: 0.48, slow: 0.36 };

const QUALITY_RANK: Record<NativeVoice['quality'], number> = { premium: 2, enhanced: 1, default: 0 };
const PREFS_KEY = 'phonics.iosVoices';

/** English, non-novelty voices; best quality first, en-US before other accents. */
export async function listEnglishVoices(): Promise<NativeVoice[]> {
  const { voices } = await NativeTTS.getVoices();
  return voices
    .filter((v) => v.language.toLowerCase().startsWith('en') && !v.novelty && !v.id.includes('eloquence'))
    .sort(
      (a, b) =>
        QUALITY_RANK[b.quality] - QUALITY_RANK[a.quality] ||
        Number(b.language === 'en-US') - Number(a.language === 'en-US') ||
        a.name.localeCompare(b.name)
    );
}

export function getVoicePrefs(): Partial<Record<TeacherVoiceKey, string>> {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

export function setVoicePref(teacher: TeacherVoiceKey, voiceId: string) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...getVoicePrefs(), [teacher]: voiceId }));
  } catch (e) {}
}

/** Default pick when the user hasn't chosen: Puck gets the best male voice, Kore/Zephyr the best two female voices. */
export function defaultVoiceFor(teacher: TeacherVoiceKey, voices: NativeVoice[]): NativeVoice | undefined {
  const female = voices.filter((v) => v.gender !== 'male');
  const male = voices.filter((v) => v.gender === 'male');
  if (teacher === 'Puck') return male[0] ?? voices[0];
  if (teacher === 'Zephyr') return female[1] ?? female[0] ?? voices[0];
  return female[0] ?? voices[0];
}
