import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { getAudioFromCache, saveAudioToCache } from './indexedDb';

// On iOS (Capacitor) speech is synthesized on-device by AVSpeechSynthesizer: no server, no cache.
export const isNativeApp = Capacitor.isNativePlatform();

// Apple English male voices, used for the male teacher (Puck)
const APPLE_MALE_VOICES = ['evan', 'nathan', 'tom', 'aaron', 'alex', 'fred', 'daniel', 'arthur', 'oliver', 'rishi', 'gordon'];

function appleVoiceQuality(voiceURI: string): number {
  const uri = voiceURI.toLowerCase();
  if (uri.includes('premium')) return 3;
  if (uri.includes('enhanced')) return 2;
  if (uri.includes('siri')) return 1;
  return 0;
}

export type TtsEngine = 'vibevoice' | 'kokoro';
export type AudioPlaybackSource = 'indexeddb' | 'server-cache' | TtsEngine | 'ios-native' | 'browser-fallback';

type SpeakOptions = {
  voiceName?: 'Kore' | 'Puck' | 'Zephyr';
  breakdown?: boolean;
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
  private engine: TtsEngine = 'vibevoice';
  private nativeVoiceIndex: Promise<Record<string, number | undefined>> | null = null;

  constructor() {
    // AudioContext will be lazily initialized upon first user interaction
    try {
      if (localStorage.getItem(ENGINE_STORAGE_KEY) === 'kokoro') this.engine = 'kokoro';
    } catch (e) {}
  }

  /**
   * Pick the best installed iOS English voices once: premium > enhanced > standard, en-US first.
   * Kore/Zephyr get the top two female-or-any voices, Puck the best male voice.
   */
  private getNativeVoices(): Promise<Record<string, number | undefined>> {
    if (!this.nativeVoiceIndex) {
      this.nativeVoiceIndex = TextToSpeech.getSupportedVoices()
        .then(({ voices }) => {
          const english = voices
            .map((v, index) => ({ ...v, index }))
            .filter((v) => v.lang.toLowerCase().startsWith('en'))
            .sort(
              (a, b) =>
                appleVoiceQuality(b.voiceURI) - appleVoiceQuality(a.voiceURI) ||
                Number(b.lang === 'en-US') - Number(a.lang === 'en-US')
            );
          const isMale = (v: { name: string }) => APPLE_MALE_VOICES.includes(v.name.toLowerCase().split(' ')[0]);
          const female = english.filter((v) => !isMale(v));
          const male = english.filter(isMale);
          return {
            Kore: (female[0] ?? english[0])?.index,
            Zephyr: (female[1] ?? female[0] ?? english[0])?.index,
            Puck: (male[0] ?? english[0])?.index,
          };
        })
        .catch((err) => {
          console.warn('Could not list iOS voices, using system default:', err);
          return {};
        });
    }
    return this.nativeVoiceIndex;
  }

  private async speakNative(text: string, voice: string, slow: boolean): Promise<void> {
    const voices = await this.getNativeVoices();
    this.notifyPlayback({
      word: text,
      source: 'ios-native',
      fromCache: false,
      engine: this.engine,
      timestamp: Date.now(),
    });
    await TextToSpeech.speak({
      text,
      lang: 'en-US',
      voice: voices[voice],
      rate: slow ? 0.7 : 0.95,
      pitch: 1.05,
      volume: 1.0,
      category: 'playback',
    });
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
   * Speak a word or sentence using the selected local TTS engine (with IndexedDB caching),
   * falling back smoothly to Web Speech API if the engine is unreachable.
   * `regenerate` skips every cache and replaces the stored audio.
   */
  public async speakPhonicsWord(text: string, options: SpeakOptions = {}): Promise<void> {
    if (!this.soundEnabled) return;

    this.stopCurrentAudio();

    const cleanText = text.trim();
    if (!cleanText) return;

    this.lastRequest = { text: cleanText, options: { ...options, regenerate: false } };

    if (isNativeApp) {
      const nativeText = options.breakdown ? `${cleanText.split('').join(', ')}. ${cleanText}!` : cleanText;
      try {
        await this.speakNative(nativeText, options.voiceName || 'Kore', Boolean(options.slow || options.breakdown));
      } catch (err) {
        console.warn('iOS native speech failed:', err);
      }
      return;
    }

    const engine = this.engine;
    const voice = options.voiceName || 'Kore';
    // Cache key incorporates engine, voice and breakdown mode if active.
    // VibeVoice keeps the legacy (engine-less) key so existing cached audio stays valid.
    const cacheKey = `${engine === 'vibevoice' ? '' : `${engine}_`}${voice}_${options.breakdown ? 'breakdown_' : ''}${cleanText.toLowerCase()}`;

    // 1. TIER 1: Check IndexedDB Client Audio Cache first! (0 network latency) — skipped on regenerate
    if (!options.regenerate) {
      try {
        const cached = await getAudioFromCache(cacheKey);
        if (cached && cached.base64) {
          this.notifyPlayback({
            word: cleanText,
            source: 'indexeddb',
            fromCache: true,
            engine,
            timestamp: Date.now(),
          });
          await this.playBase64Wav(cached.base64);
          return;
        }
      } catch (e) {
        console.warn('IndexedDB audio cache lookup skipped:', e);
      }
    }

    // 2. Prepare text for teacher pronunciation
    let promptToSpeak = cleanText;
    if (options.breakdown) {
      // Phonics blending style: "c ... a ... t ... cat!"
      const letters = cleanText.split('').join(' . ');
      promptToSpeak = `${letters}. ${cleanText}!`;
    }

    // 3. TIER 2: Call server TTS endpoint (Server checks its persistent disk cache before synthesizing)
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: promptToSpeak,
          voiceName: voice,
          engine,
          regenerate: Boolean(options.regenerate),
          style: options.slow
            ? 'Slow, distinct elementary school phonics teacher enunciation for children aged 7-11'
            : 'Enthusiastic, clear, warm elementary school teacher pronouncing English phonics for children aged 7-11',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.audioBase64) {
          // Save (or overwrite, when regenerating) in IndexedDB so the client never re-synthesizes this audio
          saveAudioToCache(cacheKey, data.audioBase64, cleanText, voice).catch(console.warn);

          const source: AudioPlaybackSource = data.fromCache ? 'server-cache' : engine;
          this.notifyPlayback({
            word: cleanText,
            source,
            fromCache: Boolean(data.fromCache),
            engine,
            timestamp: Date.now(),
          });

          await this.playBase64Wav(data.audioBase64);
          return;
        }
      }
    } catch (err) {
      console.warn(`${engine} TTS fetch failed, switching to browser speech synthesis:`, err);
    }

    // 4. TIER 3 Fallback: Browser Web Speech API
    this.notifyPlayback({
      word: cleanText,
      source: 'browser-fallback',
      fromCache: false,
      engine,
      timestamp: Date.now(),
    });
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
      TextToSpeech.stop().catch(() => {});
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
