/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  query,
  limit
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";
import { AppSchema, CompanyProcedure, InventoryItem, ChecklistItem, NewsFeedPost, VideoMetadata } from "../types";
import { initialAppData } from "./mockDefaults";

// Collection References
const proceduresCol = collection(db, "procedures");
const inventoryCol = collection(db, "inventory");
const checklistCol = collection(db, "checklist");
const feedCol = collection(db, "feed");
const videosCol = collection(db, "videos");

const DEFAULT_VIDEOS_SEED: VideoMetadata[] = [
  {
    id: "default_burger_guide",
    title: "Double Cheeseburger Fast Assembly Guide",
    fileName: "mcd_kitchen_double_prep.mp4",
    fileSize: 18451200, // 18.4 MB
    fileType: "video/mp4",
    uploadedBy: "Business Manager",
    uploadedRole: "Business Manager",
    timestamp: "2026-06-15T09:30:00.000Z",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
  },
  {
    id: "default_safety_guide",
    title: "Standard Handwashing & Hygiene Walkthrough",
    fileName: "handwash_hygiene_training.mp4",
    fileSize: 12100450, // 12.1 MB
    fileType: "video/mp4",
    uploadedBy: "Trainer",
    uploadedRole: "Trainer",
    timestamp: "2026-06-16T14:15:00.000Z",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
  }
];

/**
 * Checks if Firestore is currently empty, and if so, seeds it with initial default data
 */
export async function seedFirestoreIfNeeded(): Promise<void> {
  try {
    // 1. Seed Procedures if empty
    const procSnap = await getDocs(query(proceduresCol, limit(1)));
    if (procSnap.empty) {
      console.log("Procedures cloud collection is empty. Seeding defaults...");
      const batch = writeBatch(db);
      initialAppData.procedures.forEach((p) => {
        batch.set(doc(proceduresCol, p.id), p);
      });
      await batch.commit();
    }

    // 2. Seed Inventory if empty
    const currentInvSnap = await getDocs(inventoryCol);
    if (currentInvSnap.empty) {
      console.log("Inventory cloud collection is empty. Seeding defaults...");
      const batch = writeBatch(db);
      initialAppData.inventory.forEach((i) => {
        batch.set(doc(inventoryCol, i.id), i);
      });
      await batch.commit();
    }

    // 3. Seed Checklist if empty
    const chkSnap = await getDocs(query(checklistCol, limit(1)));
    if (chkSnap.empty) {
      console.log("Checklist cloud collection is empty. Seeding defaults...");
      const batch = writeBatch(db);
      initialAppData.checklist.forEach((c) => {
        batch.set(doc(checklistCol, c.id), c);
      });
      await batch.commit();
    }

    // 4. Seed Feed if empty
    const feedSnap = await getDocs(query(feedCol, limit(1)));
    if (feedSnap.empty) {
      console.log("Feed cloud collection is empty. Seeding defaults...");
      const batch = writeBatch(db);
      initialAppData.feed.forEach((f) => {
        batch.set(doc(feedCol, f.id), f);
      });
      await batch.commit();
    }

    // 5. Seed Videos if empty
    const videosSnap = await getDocs(query(videosCol, limit(1)));
    if (videosSnap.empty) {
      console.log("Videos cloud collection is empty. Seeding defaults...");
      const batch = writeBatch(db);
      DEFAULT_VIDEOS_SEED.forEach((v) => {
        batch.set(doc(videosCol, v.id), v);
      });
      await batch.commit();
    }
  } catch (error) {
    console.warn("Seeding notice: could not automatically write default dataset to Cloud Firestore:", error);
  }
}



export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === undefined || obj === null) return null as any;
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    return value === undefined ? null : value;
  })) as T;
}

/**
 * Saves/updates individual item inside its collection
 */
export async function saveProcedureItemDoc(item: CompanyProcedure): Promise<void> {
  const path = `procedures/${item.id}`;
  try {
    await setDoc(doc(db, "procedures", item.id), sanitizeForFirestore(item));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteProcedureItemDoc(id: string): Promise<void> {
  const path = `procedures/${id}`;
  try {
    await deleteDoc(doc(db, "procedures", id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveInventoryItemDoc(item: InventoryItem): Promise<void> {
  const path = `inventory/${item.id}`;
  try {
    await setDoc(doc(db, "inventory", item.id), sanitizeForFirestore(item));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteInventoryItemDoc(id: string): Promise<void> {
  const path = `inventory/${id}`;
  try {
    await deleteDoc(doc(db, "inventory", id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveChecklistItemDoc(item: ChecklistItem): Promise<void> {
  const path = `checklist/${item.id}`;
  try {
    await setDoc(doc(db, "checklist", item.id), sanitizeForFirestore(item));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteChecklistItemDoc(id: string): Promise<void> {
  const path = `checklist/${id}`;
  try {
    await deleteDoc(doc(db, "checklist", id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveNewsFeedPostDoc(item: NewsFeedPost): Promise<void> {
  const path = `feed/${item.id}`;
  try {
    await setDoc(doc(db, "feed", item.id), sanitizeForFirestore(item));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteNewsFeedPostDoc(id: string): Promise<void> {
  const path = `feed/${id}`;
  try {
    await deleteDoc(doc(db, "feed", id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveVideoMetadataDoc(item: VideoMetadata): Promise<void> {
  const path = `videos/${item.id}`;
  try {
    await setDoc(doc(db, "videos", item.id), sanitizeForFirestore(item));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteVideoMetadataDoc(id: string): Promise<void> {
  const path = `videos/${id}`;
  try {
    await deleteDoc(doc(db, "videos", id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Bulk writes entire AppSchema (mainly useful for backups restoration & factory resets)
 */
export async function bulkWriteSchemaSnapshot(schema: AppSchema): Promise<void> {
  try {
    // We clear current collections or overwrite matching documents
    const batch = writeBatch(db);

    schema.procedures.forEach((p) => {
      batch.set(doc(proceduresCol, p.id), sanitizeForFirestore(p));
    });

    schema.inventory.forEach((i) => {
      batch.set(doc(inventoryCol, i.id), sanitizeForFirestore(i));
    });

    schema.checklist.forEach((c) => {
      batch.set(doc(checklistCol, c.id), sanitizeForFirestore(c));
    });

    schema.feed.forEach((f) => {
      batch.set(doc(feedCol, f.id), sanitizeForFirestore(f));
    });

    if (schema.videos && schema.videos.length > 0) {
      schema.videos.forEach((v) => {
        batch.set(doc(videosCol, v.id), sanitizeForFirestore(v));
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "bulk-write");
  }
}
