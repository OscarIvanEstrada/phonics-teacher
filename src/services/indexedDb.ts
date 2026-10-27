import { StoredGeneratedWord, UserStats } from '../types/phonics';

const DB_NAME = 'TeacherPhonicsDB';
const DB_VERSION = 1;

const STORES = {
  GENERATED_WORDS: 'generated_words',
  WORD_MASTERY: 'word_mastery',
  AUDIO_CACHE: 'audio_cache',
  USER_PROFILE: 'user_profile',
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store 1: Generated Words (to store AI-generated words and prevent duplicates)
      if (!db.objectStoreNames.contains(STORES.GENERATED_WORDS)) {
        const wordStore = db.createObjectStore(STORES.GENERATED_WORDS, {
          keyPath: 'word',
        });
        wordStore.createIndex('familyId', 'familyId', { unique: false });
        wordStore.createIndex('pattern', 'pattern', { unique: false });
        wordStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Store 2: Word Mastery & Progress
      if (!db.objectStoreNames.contains(STORES.WORD_MASTERY)) {
        db.createObjectStore(STORES.WORD_MASTERY, { keyPath: 'wordId' });
      }

      // Store 3: Audio Cache (stores Base64 WAV from Gemini TTS)
      if (!db.objectStoreNames.contains(STORES.AUDIO_CACHE)) {
        db.createObjectStore(STORES.AUDIO_CACHE, { keyPath: 'key' });
      }

      // Store 4: User Profile & Gamification
      if (!db.objectStoreNames.contains(STORES.USER_PROFILE)) {
        db.createObjectStore(STORES.USER_PROFILE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('IndexedDB open error:', request.error);
      reject(request.error);
    };
  });

  return dbPromise;
}

// ==========================================
// 1. GENERATED WORDS (Prevents repeats)
// ==========================================

export async function saveGeneratedWords(words: StoredGeneratedWord[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.GENERATED_WORDS, 'readwrite');
    const store = tx.objectStore(STORES.GENERATED_WORDS);

    words.forEach((w) => {
      store.put({
        ...w,
        word: w.word.toLowerCase().trim(),
        isAiGenerated: true,
      });
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllGeneratedWords(): Promise<StoredGeneratedWord[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.GENERATED_WORDS, 'readonly');
    const store = tx.objectStore(STORES.GENERATED_WORDS);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getGeneratedWordsByFamily(familyId: string): Promise<StoredGeneratedWord[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.GENERATED_WORDS, 'readonly');
    const store = tx.objectStore(STORES.GENERATED_WORDS);
    const index = store.index('familyId');
    const request = index.getAll(familyId);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Returns all word strings in lowercase from IndexedDB.
 * Crucial to send to Gemini API so it NEVER re-generates an existing word!
 */
export async function getAllKnownWordsForExclusion(): Promise<string[]> {
  try {
    const words = await getAllGeneratedWords();
    return words.map((w) => w.word.toLowerCase());
  } catch (err) {
    console.warn('Could not read known words from IndexedDB:', err);
    return [];
  }
}

export async function deleteGeneratedWord(word: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.GENERATED_WORDS, 'readwrite');
    const store = tx.objectStore(STORES.GENERATED_WORDS);
    const request = store.delete(word.toLowerCase().trim());

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllGeneratedWords(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.GENERATED_WORDS, 'readwrite');
    const store = tx.objectStore(STORES.GENERATED_WORDS);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ==========================================
// 2. AUDIO CACHE (Gemini TTS base64 in IndexedDB)
// ==========================================

export interface CachedAudioRecord {
  key: string;
  base64: string;
  word?: string;
  voiceName?: string;
  savedAt: number;
  timesPlayed: number;
}

export async function saveAudioToCache(
  key: string,
  base64: string,
  word?: string,
  voiceName?: string
): Promise<void> {
  try {
    const db = await getDB();
    const cleanKey = key.toLowerCase().trim();
    const tx = db.transaction(STORES.AUDIO_CACHE, 'readwrite');
    const store = tx.objectStore(STORES.AUDIO_CACHE);

    const getReq = store.get(cleanKey);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      const record: CachedAudioRecord = {
        key: cleanKey,
        base64,
        word: word || cleanKey,
        voiceName: voiceName || 'Kore',
        savedAt: Date.now(),
        timesPlayed: existing?.timesPlayed || 1,
      };
      store.put(record);
    };
    // Resolve only once the write is committed, so readers right after see it
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Audio cache save error:', err);
  }
}

export async function getAudioFromCache(
  key: string
): Promise<{ base64: string; timesPlayed: number } | null> {
  try {
    const db = await getDB();
    const cleanKey = key.toLowerCase().trim();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.AUDIO_CACHE, 'readwrite');
      const store = tx.objectStore(STORES.AUDIO_CACHE);
      const request = store.get(cleanKey);

      request.onsuccess = () => {
        const record = request.result as CachedAudioRecord | undefined;
        if (record && record.base64) {
          // Increment times played from cache (tracking API calls saved!)
          record.timesPlayed = (record.timesPlayed || 0) + 1;
          store.put(record);
          resolve({ base64: record.base64, timesPlayed: record.timesPlayed });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function hasAudioInCache(key: string): Promise<boolean> {
  try {
    const db = await getDB();
    const cleanKey = key.toLowerCase().trim();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.AUDIO_CACHE, 'readonly');
      const request = tx.objectStore(STORES.AUDIO_CACHE).count(cleanKey);
      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function getAudioCacheStats(): Promise<{
  count: number;
  totalPlaysSaved: number;
  items: CachedAudioRecord[];
}> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.AUDIO_CACHE, 'readonly');
      const request = tx.objectStore(STORES.AUDIO_CACHE).getAll();

      request.onsuccess = () => {
        const records = (request.result || []) as CachedAudioRecord[];
        const totalPlaysSaved = records.reduce((sum, r) => sum + Math.max(0, (r.timesPlayed || 1) - 1), 0);
        resolve({
          count: records.length,
          totalPlaysSaved,
          items: records,
        });
      };
      request.onerror = () => resolve({ count: 0, totalPlaysSaved: 0, items: [] });
    });
  } catch {
    return { count: 0, totalPlaysSaved: 0, items: [] };
  }
}

export async function clearAudioCache(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.AUDIO_CACHE, 'readwrite');
    const request = tx.objectStore(STORES.AUDIO_CACHE).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/** Delete every cached audio whose key starts with `prefix` (e.g. after changing a teacher's voice). */
export async function deleteAudioCacheByPrefix(prefix: string): Promise<void> {
  const db = await getDB();
  const cleanPrefix = prefix.toLowerCase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.AUDIO_CACHE, 'readwrite');
    const request = tx.objectStore(STORES.AUDIO_CACHE).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (String(cursor.key).startsWith(cleanPrefix)) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ==========================================
// 3. WORD MASTERY
// ==========================================

export interface WordMasteryRecord {
  wordId: string;
  timesPracticed: number;
  timesCorrect: number;
  starsEarned: number;
  lastPracticed: number;
}

export async function recordWordPractice(
  wordId: string,
  isCorrect: boolean,
  starsEarned: number
): Promise<void> {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORES.WORD_MASTERY, 'readwrite');
    const store = tx.objectStore(STORES.WORD_MASTERY);
    const getReq = store.get(wordId);

    getReq.onsuccess = () => {
      const existing: WordMasteryRecord = getReq.result || {
        wordId,
        timesPracticed: 0,
        timesCorrect: 0,
        starsEarned: 0,
        lastPracticed: 0,
      };

      existing.timesPracticed += 1;
      if (isCorrect) existing.timesCorrect += 1;
      existing.starsEarned += starsEarned;
      existing.lastPracticed = Date.now();

      store.put(existing);
      resolve();
    };

    getReq.onerror = () => resolve();
  });
}

export async function getAllWordMastery(): Promise<Record<string, WordMasteryRecord>> {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORES.WORD_MASTERY, 'readonly');
    const store = tx.objectStore(STORES.WORD_MASTERY);
    const req = store.getAll();

    req.onsuccess = () => {
      const records = req.result || [];
      const map: Record<string, WordMasteryRecord> = {};
      records.forEach((r: WordMasteryRecord) => {
        map[r.wordId] = r;
      });
      resolve(map);
    };
    req.onerror = () => resolve({});
  });
}

// ==========================================
// 4. USER PROFILE & REWARDS
// ==========================================

const DEFAULT_USER_STATS: UserStats = {
  totalStars: 10, // Starting gift from teacher!
  totalGems: 5,
  currentStreak: 1,
  lastPracticeDate: new Date().toISOString().split('T')[0],
  wordsMastered: 0,
  selectedTeacher: 'spark',
  soundEnabled: true,
  unlockedStickers: ['stk-owl'], // First unlocked badge
};

export async function getUserStats(): Promise<UserStats> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.USER_PROFILE, 'readonly');
      const req = tx.objectStore(STORES.USER_PROFILE).get('current_stats');

      req.onsuccess = () => {
        if (req.result && req.result.data) {
          resolve({ ...DEFAULT_USER_STATS, ...req.result.data });
        } else {
          resolve(DEFAULT_USER_STATS);
        }
      };
      req.onerror = () => resolve(DEFAULT_USER_STATS);
    });
  } catch {
    return DEFAULT_USER_STATS;
  }
}

export async function saveUserStats(stats: UserStats): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORES.USER_PROFILE, 'readwrite');
    tx.objectStore(STORES.USER_PROFILE).put({
      key: 'current_stats',
      data: stats,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn('Failed to save user stats to IndexedDB:', err);
  }
}
