/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum InventoryCategory {
  RAW_COOLER = "Raw Cooler",
  FREEZER = "Freezer",
  PAPER_ITEMS = "Paper Items",
  DRINKS_SYRUPS = "Drinks & Syrups",
  OTHER = "Other"
}

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  // Conversion factors
  pcsPerInner: number | string;    // How many pieces are in 1 inner
  innersPerCase: number | string;  // How many inners are in 1 case
  lidInfo?: string;       // Optional documentation/Lid info specs
  // Current stock
  cases: number;          // Full cases counted
  inners: number;         // Loose inners counted
  pcs: number;            // Loose pieces counted
  // Metadata
  lastUpdated: string;
  updatedBy: string;
}

export interface CompanyProcedure {
  id: string;
  title: string;
  category: string;       // e.g., "Kitchen", "Front Counter", "Drive-Thru", "Safety"
  content: string;        // Rich text / formatting html string
  image?: string;         // Base64 data URL
  lastUpdated: string;
  updatedBy: string;
}

export interface ChecklistItem {
  id: string;
  task: string;
  category: "Opening" | "Shift Handover" | "Closing" | "Food Safety";
  completed: boolean;
  completedBy?: string;
  timeCompleted?: string;
}

export interface NewsFeedComment {
  id: string;
  author: string;
  role: string;
  text: string;
  timestamp: string;
}

export interface NewsFeedPost {
  id: string;
  author: string;
  role: "Crew" | "Kitchen Leader" | "Business Manager" | "Trainer";
  text: string;
  image?: string;         // Base64 image uploaded directly
  imageName?: string;     // Custom name for the upload photo
  likes: number;
  likedBy: string[];      // Array of user names who liked it to track likedByMe
  comments: NewsFeedComment[];
  timestamp: string;
}

export interface AppSchema {
  procedures: CompanyProcedure[];
  inventory: InventoryItem[];
  checklist: ChecklistItem[];
  feed: NewsFeedPost[];
  videos?: VideoMetadata[];
}

export interface VideoMetadata {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedBy: string;
  uploadedRole: string;
  timestamp: string;
  url?: string; // fallback or external video url if locally stored blob isn't loaded in browser DB
}

export interface BackupSnapshot {
  id: string;
  timestamp: string;
  description: string;
  data: AppSchema;
}

export interface UserSession {
  username: string;
  role: "Crew" | "Trainer" | "Kitchen Leader" | "Business Manager";
}
