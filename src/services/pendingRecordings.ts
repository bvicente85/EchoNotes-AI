const DB_NAME = 'echonotes_pending_recordings_db';
const DB_VERSION = 1;
const STORE_NAME = 'pending_recordings';

export interface PendingRecording {
  id: string;
  title: string;
  audioBlob: Blob;
  timestamp: number;
  duration: number; // in seconds
  sessionType: 'standard' | 'quick_draft' | 'meeting';
  expectedSpeakers: string;
  manualNotes: string;
  template: string;
  meetingTone: string;
  languageSetting: string;
  aiModel: string;
  customTerms: string;
  customGuidelines: string;
}

export function openPendingDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Saves a new pending recording.
 */
export async function savePendingRecording(pending: PendingRecording): Promise<void> {
  try {
    const db = await openPendingDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(pending);

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
    console.error("Failed to save pending recording to IndexedDB:", err);
    throw err;
  }
}

/**
 * Retrieves all pending recordings, sorted by timestamp descending.
 */
export async function getPendingRecordings(): Promise<Omit<PendingRecording, 'audioBlob'>[]> {
  try {
    const db = await openPendingDB();
    return new Promise<Omit<PendingRecording, 'audioBlob'>[]>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        // Map to exclude the blob for list performance if needed, or keep it. Let's exclude it from list if we want,
        // but since we want to be safe and simple, let's just return everything except we omit audioBlob in the return type
        // if we just want a lightweight list. Actually, let's map and return lightweight objects first.
        const list = results.map(({ audioBlob, ...rest }: any) => rest);
        list.sort((a: any, b: any) => b.timestamp - a.timestamp);
        resolve(list);
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
    console.error("Failed to get pending recordings:", err);
    return [];
  }
}

/**
 * Retrieves a single pending recording (including its audioBlob).
 */
export async function getPendingRecording(id: string): Promise<PendingRecording | null> {
  try {
    const db = await openPendingDB();
    return new Promise<PendingRecording | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
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
    console.error("Failed to get pending recording:", err);
    return null;
  }
}

/**
 * Deletes a pending recording.
 */
export async function deletePendingRecording(id: string): Promise<void> {
  try {
    const db = await openPendingDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

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
    console.error("Failed to delete pending recording:", err);
    throw err;
  }
}

/**
 * Clears all pending recordings.
 */
export async function clearPendingRecordings(): Promise<void> {
  try {
    const db = await openPendingDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
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
    console.error("Failed to clear pending recordings:", err);
    throw err;
  }
}
