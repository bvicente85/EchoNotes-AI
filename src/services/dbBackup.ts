const DB_NAME = 'echonote_backup_db';
const DB_VERSION = 2;
const CHUNKS_STORE = 'audio_chunks';
const METADATA_STORE = 'recording_metadata';

export interface BackupMetadata {
  mimeType: string;
  timestamp: number;
}

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        db.createObjectStore(CHUNKS_STORE, { autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE);
      }
    };
  });
}

export async function clearBackup(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([CHUNKS_STORE, METADATA_STORE], 'readwrite');
      const chunksStore = transaction.objectStore(CHUNKS_STORE);
      const metaStore = transaction.objectStore(METADATA_STORE);

      chunksStore.clear();
      metaStore.clear();

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.error("Failed to clear DB backup:", err);
  }
}

export async function saveChunk(chunk: Blob): Promise<void> {
  try {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(CHUNKS_STORE, 'readwrite');
      const store = transaction.objectStore(CHUNKS_STORE);
      store.add(chunk);

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.error("Failed to save chunk to IndexedDB:", err);
  }
}

export async function saveMetadata(meta: BackupMetadata): Promise<void> {
  try {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(METADATA_STORE, 'readwrite');
      const store = transaction.objectStore(METADATA_STORE);
      store.put(meta, 'active_session');

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.error("Failed to save metadata to IndexedDB:", err);
  }
}

export async function getBackup(): Promise<{ chunks: Blob[]; metadata: BackupMetadata } | null> {
  try {
    const db = await openDB();
    const chunks: Blob[] = [];
    let metadata: BackupMetadata | null = null;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CHUNKS_STORE, METADATA_STORE], 'readonly');
      
      // Get metadata
      const metaStore = transaction.objectStore(METADATA_STORE);
      const metaReq = metaStore.get('active_session');
      metaReq.onsuccess = () => {
        metadata = metaReq.result;
      };

      // Get chunks
      const chunksStore = transaction.objectStore(CHUNKS_STORE);
      const cursorReq = chunksStore.openCursor();
      cursorReq.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          chunks.push(cursor.value);
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        db.close();
        if (chunks.length > 0 && metadata) {
          resolve({ chunks, metadata });
        } else {
          resolve(null);
        }
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.error("Failed to recover backup from IndexedDB:", err);
    return null;
  }
}
