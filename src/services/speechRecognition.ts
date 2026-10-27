export interface PronunciationResult {
  transcript: string;
  isMatch: boolean;
  score: number; // 0 to 100
  stars: number; // 1 to 3
  feedbackEs: string;
  feedbackEn: string;
}

export class PhonicsSpeechRecognizer {
  private recognition: any = null;
  private isListening: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 3;
      }
    }
  }

  public isSupported(): boolean {
    return Boolean(this.recognition);
  }

  public startListening(
    targetWord: string,
    onResult: (result: PronunciationResult) => void,
    onError: (errorMsg: string) => void,
    onEnd?: () => void
  ) {
    if (!this.recognition) {
      onError('El reconocimiento de voz no está soportado en este navegador. Puedes usar Chrome o Edge.');
      return;
    }

    if (this.isListening) {
      try {
        this.recognition.abort();
      } catch (e) {}
    }

    this.isListening = true;

    this.recognition.onstart = () => {
      this.isListening = true;
    };

    this.recognition.onresult = (event: any) => {
      this.isListening = false;
      const results = event.results[0];
      const transcripts: string[] = [];
      for (let i = 0; i < results.length; i++) {
        transcripts.push(results[i].transcript.toLowerCase().trim());
      }

      const bestTranscript = transcripts[0] || '';
      const analysis = this.evaluatePronunciation(bestTranscript, transcripts, targetWord);
      onResult(analysis);
    };

    this.recognition.onerror = (event: any) => {
      this.isListening = false;
      let msg = 'No pudimos escuchar con claridad. ¡Intenta de nuevo!';
      if (event.error === 'not-allowed') {
        msg = 'Por favor permite el acceso al micrófono para que el profesor te escuche.';
      } else if (event.error === 'no-speech') {
        msg = 'No se detectó sonido. Habla cerca del micrófono.';
      }
      onError(msg);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (onEnd) onEnd();
    };

    try {
      this.recognition.start();
    } catch (err: any) {
      this.isListening = false;
      onError('Error al iniciar el micrófono: ' + err.message);
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.isListening = false;
    }
  }

  private evaluatePronunciation(
    primaryTranscript: string,
    allAlternatives: string[],
    targetWord: string
  ): PronunciationResult {
    const cleanTarget = targetWord.toLowerCase().trim();
    const cleanSpoken = primaryTranscript.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '').trim();

    // 1. Direct or alternative exact match
    const hasExactMatch =
      cleanSpoken === cleanTarget ||
      allAlternatives.some((alt) => alt.toLowerCase().trim() === cleanTarget);

    if (hasExactMatch) {
      return {
        transcript: cleanSpoken || cleanTarget,
        isMatch: true,
        score: 100,
        stars: 3,
        feedbackEs: '¡Pronunciación perfecta! ¡Sonó exactamente como un nativo!',
        feedbackEn: 'Awesome pronunciation! You nailed it!',
      };
    }

    // 2. Check if spoken includes target word (e.g. kid said "a cat" or "cat please")
    const wordsSpoken = cleanSpoken.split(/\s+/);
    if (wordsSpoken.includes(cleanTarget)) {
      return {
        transcript: cleanSpoken,
        isMatch: true,
        score: 90,
        stars: 3,
        feedbackEs: '¡Excelente! Escuché la palabra clara en tu frase.',
        feedbackEn: 'Great job! Loud and clear.',
      };
    }

    // 3. Levenshtein edit distance check (1 letter off, e.g. "cats" vs "cat" or "cut" vs "cat")
    const dist = this.levenshtein(cleanSpoken, cleanTarget);
    if (dist <= 1 && cleanTarget.length >= 3) {
      return {
        transcript: cleanSpoken,
        isMatch: true,
        score: 75,
        stars: 2,
        feedbackEs: `¡Casi perfecto! Dijiste "${cleanSpoken}". ¡Presta atención al final!`,
        feedbackEn: 'Super close! Listen one more time and repeat.',
      };
    }

    // 4. Try again
    return {
      transcript: cleanSpoken || '(sonido bajo)',
      isMatch: false,
      score: 40,
      stars: 1,
      feedbackEs: `Escuché "${cleanSpoken || 'algo bajito'}". Escucha al profesor y repite con fuerza.`,
      feedbackEn: "Good try! Let's practice it together.",
    };
  }

  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }
}

export const phonicsSpeechRecognizer = new PhonicsSpeechRecognizer();
