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
  onSnapshot,
  query,
  limit
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";
import { AppSchema, CompanyProcedure, InventoryItem, ChecklistItem, NewsFeedPost } from "../types";
import { initialAppData } from "./mockDefaults";

// Collection References
const proceduresCol = collection(db, "procedures");
const inventoryCol = collection(db, "inventory");
const checklistCol = collection(db, "checklist");
const feedCol = collection(db, "feed");

/**
 * Checks if Firestore is currently empty, and if so, seeds it with initial default data
 */
export async function seedFirestoreIfNeeded(): Promise<void> {
  const pathToCheck = "procedures";
  try {
    const snap = await getDocs(query(proceduresCol, limit(1)));
    if (snap.empty) {
      console.log("Firestore cloud collection is empty. Seeding MCD mock default dataset...");
      const batch = writeBatch(db);

      // Seed Procedures
      initialAppData.procedures.forEach((p) => {
        const d = doc(proceduresCol, p.id);
        batch.set(d, p);
      });

      // Seed Inventory
      initialAppData.inventory.forEach((i) => {
        const d = doc(inventoryCol, i.id);
        batch.set(d, i);
      });

      // Seed Checklist
      initialAppData.checklist.forEach((c) => {
        const d = doc(checklistCol, c.id);
        batch.set(d, c);
      });

      // Seed Feed Posts
      initialAppData.feed.forEach((f) => {
        const d = doc(feedCol, f.id);
        batch.set(d, f);
      });

      await batch.commit();
      console.log("Default dataset seeded successfully onto cloud Firestore.");
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, pathToCheck);
  }
}

/**
 * Set up real-time sync listeners for each of the collections, updating the local React app state
 */
export function subscribeToAppSchema(
  onDataUpdate: (data: Partial<AppSchema>) => void,
  onError: (err: any) => void
): () => void {
  // Subscribe to Procedures
  const unsubProcedures = onSnapshot(
    proceduresCol,
    (snapshot) => {
      const list: CompanyProcedure[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as CompanyProcedure);
      });
      onDataUpdate({ procedures: list });
    },
    (err) => {
      console.error("Firestore Procedures sync error:", err);
      onError(err);
    }
  );

  // Subscribe to Inventory
  const unsubInventory = onSnapshot(
    inventoryCol,
    (snapshot) => {
      const list: InventoryItem[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as InventoryItem);
      });
      onDataUpdate({ inventory: list });
    },
    (err) => {
      console.error("Firestore Inventory sync error:", err);
      onError(err);
    }
  );

  // Subscribe to Checklist
  const unsubChecklist = onSnapshot(
    checklistCol,
    (snapshot) => {
      const list: ChecklistItem[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as ChecklistItem);
      });
      onDataUpdate({ checklist: list });
    },
    (err) => {
      console.error("Firestore Checklist sync error:", err);
      onError(err);
    }
  );

  // Subscribe to Feed
  const unsubFeed = onSnapshot(
    feedCol,
    (snapshot) => {
      const list: NewsFeedPost[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as NewsFeedPost);
      });
      // Sort in descending order of timestamp so latest announcements show first
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onDataUpdate({ feed: list });
    },
    (err) => {
      console.error("Firestore News Feed sync error:", err);
      onError(err);
    }
  );

  // Return composite unsubscriber function
  return () => {
    unsubProcedures();
    unsubInventory();
    unsubChecklist();
    unsubFeed();
  };
}

/**
 * Saves/updates individual item inside its collection
 */
export async function saveProcedureItemDoc(item: CompanyProcedure): Promise<void> {
  const path = `procedures/${item.id}`;
  try {
    await setDoc(doc(db, "procedures", item.id), item);
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
    await setDoc(doc(db, "inventory", item.id), item);
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
    await setDoc(doc(db, "checklist", item.id), item);
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
    await setDoc(doc(db, "feed", item.id), item);
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

/**
 * Bulk writes entire AppSchema (mainly useful for backups restoration & factory resets)
 */
export async function bulkWriteSchemaSnapshot(schema: AppSchema): Promise<void> {
  try {
    // We clear current collections or overwrite matching documents
    const batch = writeBatch(db);

    schema.procedures.forEach((p) => {
      batch.set(doc(proceduresCol, p.id), p);
    });

    schema.inventory.forEach((i) => {
      batch.set(doc(inventoryCol, i.id), i);
    });

    schema.checklist.forEach((c) => {
      batch.set(doc(checklistCol, c.id), c);
    });

    schema.feed.forEach((f) => {
      batch.set(doc(feedCol, f.id), f);
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "bulk-write");
  }
}
