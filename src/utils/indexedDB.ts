/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Standard IndexedDB wrapper to store and retrieve large video files (up to 500MB per file)
 * without exceeding Firestore document/metadata limits (1MB).
 */

const DB_NAME = "mcd_ops_videos_db";
const DB_VERSION = 1;
const STORE_NAME = "videos";

export function getIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Save a complete video blob (File) associated with a unique video ID
 */
export async function storeVideoBlob(id: string, file: Blob | File): Promise<void> {
  const db = await getIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    
    const request = store.put({
      id,
      file,
      name: file instanceof File ? file.name : "video.mp4",
      type: file.type,
      timestamp: new Date().toISOString()
    });
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = () => {
      reject(transaction.error || request.error);
    };
  });
}

/**
 * Retrieve the saved video file/blob for playback and download
 */
export async function getVideoBlob(id: string): Promise<Blob | null> {
  try {
    const db = await getIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      
      request.onsuccess = () => {
        resolve(request.result ? request.result.file : null);
      };
      
      request.onerror = () => {
        reject(transaction.error || request.error);
      };
    });
  } catch (err) {
    console.warn("IndexedDB was not primed or failed to read:", err);
    return null;
  }
}

/**
 * Remove a video's binary payload from the browser db
 */
export async function deleteVideoBlob(id: string): Promise<void> {
  const db = await getIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = () => {
      reject(transaction.error || request.error);
    };
  });
}
