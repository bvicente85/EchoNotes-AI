const DB_NAME = 'echonotes_local_audio_db';
const DB_VERSION = 1;
const AUDIO_STORE = 'cached_audios';

export interface CachedAudio {
  meetingId: string;
  audioBlob: Blob;
  timestamp: number;
}

export function openAudioDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE, { keyPath: 'meetingId' });
      }
    };
  });
}

/**
 * Saves a recorded or uploaded audio blob linked to a meeting ID in IndexedDB.
 */
export async function saveAudio(meetingId: string, audioBlob: Blob): Promise<void> {
  try {
    const db = await openAudioDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(AUDIO_STORE, 'readwrite');
      const store = transaction.objectStore(AUDIO_STORE);
      
      const record: CachedAudio = {
        meetingId,
        audioBlob,
        timestamp: Date.now()
      };
      
      const request = store.put(record);

      request.onsuccess = () => {
        resolve();
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
      
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.error("Failed to save audio to local IndexedDB store:", err);
  }
}

/**
 * Retrieves the audio blob for a specific meeting ID.
 */
export async function getAudio(meetingId: string): Promise<Blob | null> {
  try {
    const db = await openAudioDB();
    return new Promise<Blob | null>((resolve, reject) => {
      const transaction = db.transaction(AUDIO_STORE, 'readonly');
      const store = transaction.objectStore(AUDIO_STORE);
      const request = store.get(meetingId);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.audioBlob);
        } else {
          resolve(null);
        }
      };

      transaction.oncomplete = () => {
        db.close();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.error("Failed to get audio from local IndexedDB store:", err);
    return null;
  }
}

/**
 * Deletes an audio from IndexedDB. This is useful if a meeting is deleted from history.
 */
export async function deleteAudio(meetingId: string): Promise<void> {
  try {
    const db = await openAudioDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(AUDIO_STORE, 'readwrite');
      const store = transaction.objectStore(AUDIO_STORE);
      const request = store.delete(meetingId);

      request.onsuccess = () => {
        resolve();
      };

      transaction.oncomplete = () => {
        db.close();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.error("Failed to delete audio from local IndexedDB store:", err);
  }
}

/**
 * Automatically cleans up audio savings that are older than the specified retention days.
 * The default is 30 days as requested by the user.
 */
export async function cleanExpiredAudios(retentionDays: number = 30): Promise<number> {
  try {
    const db = await openAudioDB();
    return new Promise<number>((resolve, reject) => {
      const transaction = db.transaction(AUDIO_STORE, 'readwrite');
      const store = transaction.objectStore(AUDIO_STORE);
      const request = store.openCursor();
      
      const now = Date.now();
      const expirationMs = retentionDays * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          const record: CachedAudio = cursor.value;
          const ageMs = now - record.timestamp;
          if (ageMs > expirationMs) {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        db.close();
        if (deletedCount > 0) {
          console.log(`[AudioStorage] Auto-cleaned ${deletedCount} expired recordings older than ${retentionDays} days.`);
        }
        resolve(deletedCount);
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.error("Failed to run automatic audio expiration clean up:", err);
    return 0;
  }
}

/**
 * Clears all cached audios from local IndexedDB.
 */
export async function clearAllAudios(): Promise<void> {
  try {
    const db = await openAudioDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(AUDIO_STORE, 'readwrite');
      const store = transaction.objectStore(AUDIO_STORE);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      transaction.oncomplete = () => {
        db.close();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.error("Failed to clear local audio cache:", err);
  }
}

/**
 * Calculates the total storage size of all cached audio files in bytes.
 */
export async function getAudioStorageSize(): Promise<number> {
  try {
    const db = await openAudioDB();
    return new Promise<number>((resolve, reject) => {
      const transaction = db.transaction(AUDIO_STORE, 'readonly');
      const store = transaction.objectStore(AUDIO_STORE);
      const request = store.openCursor();
      
      let totalSize = 0;

      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          const record: CachedAudio = cursor.value;
          if (record.audioBlob) {
            totalSize += record.audioBlob.size;
          }
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        db.close();
        resolve(totalSize);
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.error("Failed to calculate total audio storage size:", err);
    return 0;
  }
}

