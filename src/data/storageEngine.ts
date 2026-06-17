/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppSchema, BackupSnapshot } from "../types";
import { initialAppData } from "./mockDefaults";

const STORAGE_KEY = "mcd_crew_app_database";
const BACKUPS_KEY = "mcd_crew_app_backups";

// Helper to write to localStorage cleanly
function saveToLocal(key: string, data: any) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error("Local storage save error:", error);
  }
}

// Helper to load from localStorage cleanly
function loadFromLocal<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw) as T;
    }
  } catch (error) {
    console.error("Local storage load error:", error);
  }
  return defaultValue;
}

/**
 * Initializes and returns the current database state
 */
export function getStoredData(): AppSchema {
  const localData = localStorage.getItem(STORAGE_KEY);
  if (!localData) {
    // Save defaults if first time
    saveToLocal(STORAGE_KEY, initialAppData);
    // Create initial backup
    createAutomatedBackup(initialAppData, "System Initialization Backup");
    return initialAppData;
  }
  try {
    const parsed = JSON.parse(localData) as AppSchema;
    if (!parsed.inventory) parsed.inventory = [];
    if (!parsed.procedures) parsed.procedures = [];
    if (!parsed.checklist) parsed.checklist = [];
    if (!parsed.feed) parsed.feed = [];
    if (!parsed.videos) parsed.videos = [];
    return parsed;
  } catch {
    return initialAppData;
  }
}

/**
 * Saves current state and triggers automated snapshot backup
 */
export function saveStoredData(data: AppSchema, changeDescription: string = "Manual Update") {
  saveToLocal(STORAGE_KEY, data);
  // Auto backup for important history recovery
  createAutomatedBackup(data, changeDescription);
}

/**
 * Creates a backup snapshot, maintaining a maximum of 15 historical points
 */
export function createAutomatedBackup(data: AppSchema, description: string): BackupSnapshot[] {
  const backups = getBackupsList();
  
  const newBackup: BackupSnapshot = {
    id: "backup_" + Date.now(),
    timestamp: new Date().toISOString(),
    description,
    data: JSON.parse(JSON.stringify(data)) // deep copy
  };

  const updated = [newBackup, ...backups].slice(0, 15); // limit to 15 backups max to avoid filling client storage quota
  saveToLocal(BACKUPS_KEY, updated);
  return updated;
}

/**
 * Retrieves the list of historical backups
 */
export function getBackupsList(): BackupSnapshot[] {
  return loadFromLocal<BackupSnapshot[]>(BACKUPS_KEY, []);
}

/**
 * Restores a specific backup by snapshot ID
 */
export function restoreBackup(backupId: string): AppSchema | null {
  const backups = getBackupsList();
  const found = backups.find(b => b.id === backupId);
  if (found) {
    saveToLocal(STORAGE_KEY, found.data);
    return found.data;
  }
  return null;
}

/**
 * Erases all backups and resets to the default seed content
 */
export function resetDatabaseToDefault(): AppSchema {
  saveToLocal(STORAGE_KEY, initialAppData);
  const resetBackups = createAutomatedBackup(initialAppData, "Database Reset to Factory Defaults");
  saveToLocal(BACKUPS_KEY, resetBackups);
  return initialAppData;
}
