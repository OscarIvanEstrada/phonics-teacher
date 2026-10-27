import { Capacitor } from '@capacitor/core';
import { audioPath } from './audioPaths';
import { isPublished, markGenerated, readPublishedAudio } from './publishedAudio';
import { PhonemeSound, parsePhonetics } from './phonemes';
import { NativeTTS, NATIVE_RATE, TeacherVoiceKey, defaultVoiceFor, getVoicePrefs, listEnglishVoices } from './nativeTts';

// On iOS (Capacitor) speech is synthesized on-device by AVSpeechSynthesizer, then cached like web audio.
export const isNativeApp = Capacitor.isNativePlatform();

export type TtsEngine = 'vibevoice' | 'kokoro' | 'chatterbox';
export type AudioPlaybackSource = 'github' | TtsEngine | 'ios-native' | 'browser-fallback';

type SpeakOptions = {
  voiceName?: 'Kore' | 'Puck' | 'Zephyr';
  breakdown?: boolean;
  /** IPA like "/k/ /æ/ /t/": with `breakdown`, the teacher says each sound, then the word */
  phonetics?: string;
  /** Called with the index of the sound being said during a breakdown (-1 for the whole word) */
  onSound?: (index: number) => void;
  slow?: boolean;
  regenerate?: boolean;
};

const ENGINE_STORAGE_KEY = 'phonics.ttsEngine';

export interface AudioPlaybackEvent {
  word: string;
  source: AudioPlaybackSource;
  fromCache: boolean;
  engine: TtsEngine;
  timestamp: number;
}

type AudioListener = (event: AudioPlaybackEvent) => void;

class AudioService {
  private audioCtx: AudioContext | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private soundEnabled: boolean = true;
  private listeners: Set<AudioListener> = new Set();
  private lastPlaybackEvent: AudioPlaybackEvent | null = null;
  private lastRequest: { text: string; options: SpeakOptions } | null = null;
  // Kokoro is the default: it reads the IPA exactly and the course audio is pre-published with it
  private engine: TtsEngine = 'kokoro';

  constructor() {
    // AudioContext will be lazily initialized upon first user interaction
    try {
      const stored = localStorage.getItem(ENGINE_STORAGE_KEY);
      if (stored === 'vibevoice' || stored === 'chatterbox' || stored === 'kokoro') this.engine = stored;
    } catch (e) {}
  }

  /** iOS voice id for a teacher: the user's choice, or the best installed default. */
  private async resolveNativeVoiceId(teacher: TeacherVoiceKey): Promise<string | undefined> {
    const chosen = getVoicePrefs()[teacher];
    if (chosen) return chosen;
    try {
      return defaultVoiceFor(teacher, await listEnglishVoices())?.id;
    } catch (e) {
      return undefined;
    }
  }

  public getEngine(): TtsEngine {
    return this.engine;
  }

  public setEngine(engine: TtsEngine) {
    this.engine = engine;
    try {
      localStorage.setItem(ENGINE_STORAGE_KEY, engine);
    } catch (e) {}
  }

  public canRegenerateLast(): boolean {
    return this.lastRequest !== null;
  }

  /**
   * Re-synthesize the last spoken text, bypassing IndexedDB and server caches,
   * and overwrite both caches with the new take (for model hallucinations).
   */
  public regenerateLast(): Promise<void> {
    if (!this.lastRequest) return Promise.resolve();
    return this.speakPhonicsWord(this.lastRequest.text, { ...this.lastRequest.options, regenerate: true });
  }

  public subscribePlayback(listener: AudioListener): () => void {
    this.listeners.add(listener);
    if (this.lastPlaybackEvent) {
      listener(this.lastPlaybackEvent);
    }
    return () => this.listeners.delete(listener);
  }

  private notifyPlayback(event: AudioPlaybackEvent) {
    this.lastPlaybackEvent = event;
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.warn('Playback listener error:', err);
      }
    });
  }

  public getLastPlaybackEvent(): AudioPlaybackEvent | null {
    return this.lastPlaybackEvent;
  }

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  /**
   * Find an audio in the public GitHub repo, or synthesize it.
   * - Read: published audio (branch `audio`) for the selected engine, on web and iOS alike.
   * - Write: on web the server synthesizes and publishes it; on iOS (which can't write to GitHub)
   *   it is synthesized on-device and only played.
   */
  private async getAudio(
    request: { text: string; ipa?: string; slow?: boolean; breakdown?: boolean; regenerate?: boolean },
    voice: TeacherVoiceKey
  ): Promise<{ audioBase64: string; source: AudioPlaybackSource } | null> {
    const engine = this.engine;
    const path = audioPath({ engine, voice, ...request });

    if (!request.regenerate && (await isPublished(path))) {
      const audioBase64 = await readPublishedAudio(path);
      if (audioBase64) return { audioBase64, source: 'github' };
    }

    if (isNativeApp) {
      const voiceId = await this.resolveNativeVoiceId(voice);
      const rate = request.slow ? NATIVE_RATE.slow : NATIVE_RATE.normal;
      const { audioBase64 } = await NativeTTS.synthesize({ text: request.text, ipa: request.ipa, voiceId, rate });
      return { audioBase64, source: 'ios-native' };
    }

    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, voiceName: voice, engine }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.audioBase64) return null;
    markGenerated(data.path ?? path, data.audioBase64, Boolean(data.published));
    return { audioBase64: data.audioBase64, source: engine };
  }

  /**
   * Say one isolated phonics sound (or a blended chunk like a rime).
   * Kokoro and iOS read the IPA exactly; text-only engines read the teacher's spelling.
   * Each sound is one published file, so /æ/ is synthesized once and reused by every word.
   */
  public async speakSound(sound: PhonemeSound, options: { voiceName?: SpeakOptions['voiceName']; slow?: boolean } = {}): Promise<void> {
    if (!this.soundEnabled) return;
    const voice = options.voiceName || 'Kore';
    try {
      const audio = await this.getAudio({ text: sound.spoken, ipa: sound.ipa }, voice);
      if (audio) {
        await this.playBase64Wav(audio.audioBase64);
        return;
      }
    } catch (err) {
      console.warn('Phoneme audio failed:', err);
    }
    if (!isNativeApp) this.speakWithBrowserSpeech(sound.spoken, 0.7);
  }

  /** Teacher-style breakdown: each sound with a pause, then the whole word. */
  private async speakBreakdown(text: string, sounds: PhonemeSound[], options: SpeakOptions): Promise<void> {
    const gap = options.slow ? 650 : 450;
    for (let i = 0; i < sounds.length; i++) {
      options.onSound?.(i);
      await this.speakSound(sounds[i], { voiceName: options.voiceName, slow: options.slow });
      await new Promise((r) => setTimeout(r, gap));
    }
    options.onSound?.(-1);
    await new Promise((r) => setTimeout(r, gap / 2));
    await this.speakPhonicsWord(text, { voiceName: options.voiceName });
  }

  /**
   * Speak a word or sentence: published GitHub audio first, then the selected engine,
   * falling back to the browser voice on web if everything else fails.
   * `regenerate` skips the published copy and replaces it with a new take.
   */
  public async speakPhonicsWord(text: string, options: SpeakOptions = {}): Promise<void> {
    if (!this.soundEnabled) return;

    this.stopCurrentAudio();

    const cleanText = text.trim();
    if (!cleanText) return;

    this.lastRequest = { text: cleanText, options: { ...options, regenerate: false } };

    const sounds = options.breakdown && options.phonetics ? parsePhonetics(options.phonetics) : [];
    if (sounds.length > 0) return this.speakBreakdown(cleanText, sounds, options);

    const engine = this.engine;
    const voice = options.voiceName || 'Kore';
    // Without IPA, a breakdown spells the word: "c, a, t. cat!"
    const promptToSpeak = options.breakdown ? `${cleanText.split('').join(', ')}. ${cleanText}!` : cleanText;

    try {
      const audio = await this.getAudio(
        {
          text: promptToSpeak,
          slow: Boolean(options.slow || options.breakdown),
          breakdown: Boolean(options.breakdown),
          regenerate: Boolean(options.regenerate),
        },
        voice
      );
      if (audio) {
        this.notifyPlayback({
          word: cleanText,
          source: audio.source,
          fromCache: audio.source === 'github',
          engine,
          timestamp: Date.now(),
        });
        await this.playBase64Wav(audio.audioBase64);
        return;
      }
    } catch (err) {
      console.warn(`${engine} audio failed:`, err);
    }

    if (isNativeApp) {
      // Last resort on iOS: speak directly with the system voice
      const voiceId = await this.resolveNativeVoiceId(voice);
      this.notifyPlayback({ word: cleanText, source: 'ios-native', fromCache: false, engine, timestamp: Date.now() });
      await NativeTTS.speak({ text: promptToSpeak, voiceId, rate: NATIVE_RATE.normal }).catch(console.warn);
      return;
    }

    this.notifyPlayback({ word: cleanText, source: 'browser-fallback', fromCache: false, engine, timestamp: Date.now() });
    this.speakWithBrowserSpeech(promptToSpeak, options.slow ? 0.75 : 0.9);
  }

  /**
   * Browser SpeechSynthesis fallback
   */
  public speakWithBrowserSpeech(text: string, rate: number = 0.85) {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate;
    utterance.pitch = 1.1; // Cheerful tone for kids

    // Try finding a nice English voice
    const voices = window.speechSynthesis.getVoices();
    const englishVoice =
      voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Natural'))) ||
      voices.find((v) => v.lang.startsWith('en'));

    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Play base64 WAV returned by the TTS endpoint
   */
  private playBase64Wav(base64Data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const audio = new Audio(`data:audio/wav;base64,${base64Data}`);
        this.currentAudioElement = audio;
        audio.onended = () => {
          this.currentAudioElement = null;
          resolve();
        };
        audio.onerror = (e) => {
          this.currentAudioElement = null;
          reject(e);
        };
        audio.play().catch(reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  public stopCurrentAudio() {
    if (this.currentAudioElement) {
      this.currentAudioElement.pause();
      this.currentAudioElement.currentTime = 0;
      this.currentAudioElement = null;
    }
    if (isNativeApp) {
      NativeTTS.stop().catch(() => {});
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  // ==========================================
  // Web Audio Synthesized Sound Effects
  // Zero external latency, 100% reliable
  // ==========================================

  public playStarSound() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';

      // Arpeggiated high sparkle (C6 -> E6 -> G6 -> B6)
      osc1.frequency.setValueAtTime(1046.5, now); // C6
      osc1.frequency.exponentialRampToValueAtTime(1318.5, now + 0.08); // E6
      osc1.frequency.exponentialRampToValueAtTime(1567.98, now + 0.16); // G6
      osc1.frequency.exponentialRampToValueAtTime(1975.53, now + 0.24); // B6

      osc2.frequency.setValueAtTime(2093.0, now + 0.24); // C7

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.24);
      osc1.stop(now + 0.5);
      osc2.stop(now + 0.5);
    } catch (e) {
      // AudioContext might be muted or not allowed yet
    }
  }

  public playCorrectSound() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.12); // A5

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  public playPopSound() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.06);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }

  public playCelebrationFanfare() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + index * 0.1);

        gain.gain.setValueAtTime(0.2, now + index * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.1 + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + index * 0.1);
        osc.stop(now + index * 0.1 + 0.45);
      });
    } catch (e) {}
  }

  public playChalkSound() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.05);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {}
  }
}

export const audioService = new AudioService();
