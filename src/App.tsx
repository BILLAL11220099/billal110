/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UserSession, AppSchema, CompanyProcedure, InventoryItem, ChecklistItem, NewsFeedPost, VideoMetadata } from "./types";
import { getStoredData, saveStoredData, resetDatabaseToDefault } from "./data/storageEngine";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "./data/firebase";
import { signInAnonymously } from "firebase/auth";
import {
  seedFirestoreIfNeeded,
  saveProcedureItemDoc,
  deleteProcedureItemDoc,
  saveInventoryItemDoc,
  deleteInventoryItemDoc,
  saveChecklistItemDoc,
  deleteChecklistItemDoc,
  saveNewsFeedPostDoc,
  deleteNewsFeedPostDoc,
  bulkWriteSchemaSnapshot,
  saveVideoMetadataDoc,
  deleteVideoMetadataDoc
} from "./data/firebaseSync";
import Login from "./components/Login";
import SearchGlobal from "./components/SearchGlobal";
import DashboardPanel from "./components/DashboardPanel";
import ProceduresPanel from "./components/ProceduresPanel";
import InventoryPanel from "./components/InventoryPanel";
import DailySystemPanel from "./components/DailySystemPanel";
import NewsFeedPanel from "./components/NewsFeedPanel";
import BackupsPanel from "./components/BackupsPanel";
import WorkstationApp from "./components/workstation/WorkstationApp";

import {
  LayoutDashboard, BookOpen, Warehouse, CheckSquare, MessageSquare, ShieldAlert,
  LogOut, Clock, UserCheck, Sparkles, ChefHat, Salad, RefreshCw
} from "lucide-react";

function parseCollections(
  procDocs: any[],
  invDocs: any[],
  chkDocs: any[],
  feedDocs: any[],
  videoDocs: any[]
): AppSchema {
  const proceduresList: CompanyProcedure[] = [];
  procDocs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data) {
      proceduresList.push({
        id: data.id || docSnap.id,
        title: data.title || "Untitled Procedure",
        category: data.category || "General",
        content: data.content || "",
        image: data.image || undefined,
        lastUpdated: data.lastUpdated || new Date().toISOString(),
        updatedBy: data.updatedBy || "System Sync"
      });
    }
  });

  const inventoryList: InventoryItem[] = [];
  invDocs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data) {
      inventoryList.push({
        id: data.id || docSnap.id,
        name: data.name || "Unnamed Item",
        category: data.category || "Other",
        pcsPerInner: data.pcsPerInner !== undefined ? data.pcsPerInner : 1,
        innersPerCase: data.innersPerCase !== undefined ? data.innersPerCase : 1,
        lidInfo: data.lidInfo || undefined,
        cases: typeof data.cases === "number" ? data.cases : (Number(data.cases) || 0),
        inners: typeof data.inners === "number" ? data.inners : (Number(data.inners) || 0),
        pcs: typeof data.pcs === "number" ? data.pcs : (Number(data.pcs) || 0),
        lastUpdated: data.lastUpdated || new Date().toISOString(),
        updatedBy: data.updatedBy || "System Sync"
      });
    }
  });

  const checklistList: ChecklistItem[] = [];
  chkDocs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data) {
      checklistList.push({
        id: data.id || docSnap.id,
        task: data.task || "",
        category: data.category || "Opening",
        completed: !!data.completed,
        completedBy: data.completedBy || "",
        timeCompleted: data.timeCompleted || ""
      });
    }
  });

  const feedList: NewsFeedPost[] = [];
  feedDocs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data) {
      feedList.push({
        id: data.id || docSnap.id,
        author: data.author || "Crew Member",
        role: data.role || "Crew",
        text: data.text || "",
        image: data.image || undefined,
        imageName: data.imageName || undefined,
        likes: typeof data.likes === "number" ? data.likes : (Number(data.likes) || 0),
        likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
        comments: Array.isArray(data.comments) ? data.comments : [],
        timestamp: data.timestamp || new Date().toISOString()
      });
    }
  });
  feedList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const videosList: VideoMetadata[] = [];
  videoDocs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data) {
      videosList.push({
        id: data.id || docSnap.id,
        title: data.title || "Untitled Video",
        fileName: data.fileName || "",
        fileSize: typeof data.fileSize === "number" ? data.fileSize : (Number(data.fileSize) || 0),
        fileType: data.fileType || "video/mp4",
        uploadedBy: data.uploadedBy || "System Sync",
        uploadedRole: data.uploadedRole || "Crew",
        timestamp: data.timestamp || new Date().toISOString(),
        url: data.url || undefined,
        downloadUrl: data.downloadUrl || undefined,
        thumbnail: data.thumbnail || undefined,
        status: data.status || "Ready",
        progress: data.progress || 100,
        views: data.views || 0,
        description: data.description || "",
        category: data.category || "General",
      });
    }
  });

  return {
    procedures: proceduresList,
    inventory: inventoryList,
    checklist: checklistList,
    feed: feedList,
    videos: videosList
  };
}

export default function App() {
  const [session, setSession] = useState<UserSession | null>(() => {
    // Check if session cached locally for convenience
    const saved = localStorage.getItem("mcd_crew_session");
    if (saved) {
      try { return JSON.parse(saved); } catch { return null; }
    }
    return null;
  });

  const [appData, setAppData] = useState<AppSchema>(() => getStoredData());
  const [activeTab, setActiveTab] = useState<"dashboard" | "procedures" | "inventory" | "checklist" | "feed" | "backups">("dashboard");
  
  // Real-time Clock State
  const [currentTime, setCurrentTime] = useState(new Date());

  // Sync Indicator state
  const [syncStatus, setSyncStatus] = useState<"connecting" | "connected" | "error">("connecting");

  // Track initial sync status across collections before lifting the splash gate
  const [initialSyncProgress, setInitialSyncProgress] = useState({
    procedures: false,
    inventory: false,
    checklist: false,
    feed: false,
    videos: false
  });

  const [isForceSyncing, setIsForceSyncing] = useState(false);
  const [isVideoHubOpen, setIsVideoHubOpen] = useState(false);

  // Search-linked active structures (for opening editors directly)
  const [activeSelectedProcedure, setActiveSelectedProcedure] = useState<CompanyProcedure | null>(null);
  const [activeSelectedInventory, setActiveSelectedInventory] = useState<InventoryItem | null>(null);
  const [activeSelectedChecklist, setActiveSelectedChecklist] = useState<ChecklistItem | null>(null);
  const [activeSelectedFeedPost, setActiveSelectedFeedPost] = useState<NewsFeedPost | null>(null);

  // Update Clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Safeguard Connection Timeout helper: if offline or lagging, bypass progress barrier after 3.5 seconds
  useEffect(() => {
    const syncTimeout = setTimeout(() => {
      setInitialSyncProgress((prev) => {
        if (!prev.procedures || !prev.inventory || !prev.checklist || !prev.feed || !prev.videos) {
          console.warn("Initial Cloud connection took longer than 3.5s. Falling back to local replication cache.");
          return {
            procedures: true,
            inventory: true,
            checklist: true,
            feed: true,
            videos: true
          };
        }
        return prev;
      });
    }, 3500);

    return () => clearTimeout(syncTimeout);
  }, []);

  // Live Real-Time Multi-user synchronization
  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const initializeRealtimeListeners = async () => {
      setSyncStatus("connecting");
      try {
        await signInAnonymously(auth);
      } catch (authErr) {
        console.warn("Anonymous registration was skipped or failed:", authErr);
      }

      try {
        // Run seed check
        await seedFirestoreIfNeeded();
      } catch (err) {
        console.warn("Auto-seeding was skipped or encountered a transient issue:", err);
      }

      // Helper to update specific key inside appData state
      const updateCollectionState = (key: keyof AppSchema, newList: any) => {
        setAppData((prev) => {
          const updated = { ...prev, [key]: newList };
          try {
            localStorage.setItem("mcd_crew_app_database", JSON.stringify(updated));
          } catch (e) {
            console.error(`Local storage error saving ${key}:`, e);
          }
          return updated;
        });
        setInitialSyncProgress((prev) => ({ ...prev, [key]: true }));
      };

      try {
        // 1. Subscribe to procedures
        const unsubProc = onSnapshot(
          collection(db, "procedures"),
          (snapshot) => {
            const list: CompanyProcedure[] = [];
            snapshot.docs.forEach((docSnap) => {
              const data = docSnap.data();
              if (data) {
                list.push({
                  id: data.id || docSnap.id,
                  title: data.title || "Untitled Procedure",
                  category: data.category || "General",
                  content: data.content || "",
                  image: data.image || undefined,
                  lastUpdated: data.lastUpdated || new Date().toISOString(),
                  updatedBy: data.updatedBy || "System Sync"
                });
              }
            });
            updateCollectionState("procedures", list);
            setSyncStatus("connected");
          },
          (error) => {
            console.error("Procedures listener error:", error);
            try {
              handleFirestoreError(error, OperationType.GET, "procedures");
            } catch (errInfo) {
              console.warn("Procedures cloud sync offline or rule propagating, using local backup replication cache.", errInfo);
            }
            setSyncStatus("error");
          }
        );
        unsubs.push(unsubProc);

        // 2. Subscribe to inventory
        const unsubInv = onSnapshot(
          collection(db, "inventory"),
          (snapshot) => {
            const list: InventoryItem[] = [];
            snapshot.docs.forEach((docSnap) => {
              const data = docSnap.data();
              if (data) {
                list.push({
                  id: data.id || docSnap.id,
                  name: data.name || "Unnamed Item",
                  category: data.category || "Other",
                  pcsPerInner: data.pcsPerInner !== undefined ? data.pcsPerInner : 1,
                  innersPerCase: data.innersPerCase !== undefined ? data.innersPerCase : 1,
                  lidInfo: data.lidInfo || undefined,
                  cases: typeof data.cases === "number" ? data.cases : (Number(data.cases) || 0),
                  inners: typeof data.inners === "number" ? data.inners : (Number(data.inners) || 0),
                  pcs: typeof data.pcs === "number" ? data.pcs : (Number(data.pcs) || 0),
                  lastUpdated: data.lastUpdated || new Date().toISOString(),
                  updatedBy: data.updatedBy || "System Sync"
                });
              }
            });
            updateCollectionState("inventory", list);
            setSyncStatus("connected");
          },
          (error) => {
            console.error("Inventory listener error:", error);
            try {
              handleFirestoreError(error, OperationType.GET, "inventory");
            } catch (errInfo) {
              console.warn("Inventory cloud sync offline or rule propagating, using local backup replication cache.", errInfo);
            }
            setSyncStatus("error");
          }
        );
        unsubs.push(unsubInv);

        // 3. Subscribe to checklist
        const unsubChk = onSnapshot(
          collection(db, "checklist"),
          (snapshot) => {
            const list: ChecklistItem[] = [];
            snapshot.docs.forEach((docSnap) => {
              const data = docSnap.data();
              if (data) {
                list.push({
                  id: data.id || docSnap.id,
                  task: data.task || "",
                  category: data.category || "Opening",
                  completed: !!data.completed,
                  completedBy: data.completedBy || "",
                  timeCompleted: data.timeCompleted || ""
                });
              }
            });
            updateCollectionState("checklist", list);
            setSyncStatus("connected");
          },
          (error) => {
            console.error("Checklist listener error:", error);
            try {
              handleFirestoreError(error, OperationType.GET, "checklist");
            } catch (errInfo) {
              console.warn("Checklist cloud sync offline or rule propagating, using local backup replication cache.", errInfo);
            }
            setSyncStatus("error");
          }
        );
        unsubs.push(unsubChk);

        // 4. Subscribe to feed
        const unsubFeed = onSnapshot(
          collection(db, "feed"),
          (snapshot) => {
            const list: NewsFeedPost[] = [];
            snapshot.docs.forEach((docSnap) => {
              const data = docSnap.data();
              if (data) {
                list.push({
                  id: data.id || docSnap.id,
                  author: data.author || "Crew Member",
                  role: data.role || "Crew",
                  text: data.text || "",
                  image: data.image || undefined,
                  imageName: data.imageName || undefined,
                  likes: typeof data.likes === "number" ? data.likes : (Number(data.likes) || 0),
                  likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
                  comments: Array.isArray(data.comments) ? data.comments : [],
                  timestamp: data.timestamp || new Date().toISOString()
                });
              }
            });
            list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            updateCollectionState("feed", list);
            setSyncStatus("connected");
          },
          (error) => {
            console.error("Feed listener error:", error);
            try {
              handleFirestoreError(error, OperationType.GET, "feed");
            } catch (errInfo) {
              console.warn("Feed cloud sync offline or rule propagating, using local backup replication cache.", errInfo);
            }
            setSyncStatus("error");
          }
        );
        unsubs.push(unsubFeed);

        // 5. Subscribe to videos
        const unsubVideos = onSnapshot(
          collection(db, "videos"),
          (snapshot) => {
            const list: VideoMetadata[] = [];
            snapshot.docs.forEach((docSnap) => {
              const data = docSnap.data();
              if (data) {
                list.push({
                  id: data.id || docSnap.id,
                  title: data.title || "Untitled Video",
                  fileName: data.fileName || "",
                  fileSize: typeof data.fileSize === "number" ? data.fileSize : (Number(data.fileSize) || 0),
                  fileType: data.fileType || "video/mp4",
                  uploadedBy: data.uploadedBy || "System Sync",
                  uploadedRole: data.uploadedRole || "Crew",
                  timestamp: data.timestamp || new Date().toISOString(),
                  url: data.url || undefined,
                  downloadUrl: data.downloadUrl || undefined,
                  thumbnail: data.thumbnail || undefined,
                  status: data.status || "Ready",
                  progress: data.progress || 100,
                  views: data.views || 0,
                  description: data.description || "",
                  category: data.category || "General",
                });
              }
            });
            updateCollectionState("videos", list);
            setSyncStatus("connected");
          },
          (error) => {
            console.error("Videos listener error:", error);
            try {
              handleFirestoreError(error, OperationType.GET, "videos");
            } catch (errInfo) {
              console.warn("Videos cloud sync offline or rule propagating, using local backup replication cache.", errInfo);
            }
            setSyncStatus("error");
          }
        );
        unsubs.push(unsubVideos);

      } catch (err) {
        console.error("Realtime subscription error:", err);
        setSyncStatus("error");
        setInitialSyncProgress({
          procedures: true,
          inventory: true,
          checklist: true,
          feed: true,
          videos: true
        });
      }
    };

    initializeRealtimeListeners();

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, []);

  // Force Full Real-Time Re-synchronization callback
  const forceSync = async () => {
    if (isForceSyncing) return;
    setIsForceSyncing(true);
    setSyncStatus("connecting");
    try {
      const [procSnap, invSnap, chkSnap, feedSnap, vSnap] = await Promise.all([
        getDocs(collection(db, "procedures")),
        getDocs(collection(db, "inventory")),
        getDocs(collection(db, "checklist")),
        getDocs(collection(db, "feed")),
        getDocs(collection(db, "videos"))
      ]);

      const updated = parseCollections(
        procSnap.docs,
        invSnap.docs,
        chkSnap.docs,
        feedSnap.docs,
        vSnap.docs
      );

      setAppData(updated);
      try {
        localStorage.setItem("mcd_crew_app_database", JSON.stringify(updated));
      } catch (e) {
        console.error("Local storage error in force sync:", e);
      }

      setSyncStatus("connected");
      setInitialSyncProgress({
        procedures: true,
        inventory: true,
        checklist: true,
        feed: true,
        videos: true
      });
    } catch (err) {
      console.error("Force sync from cloud error:", err);
      setSyncStatus("error");
    } finally {
      setIsForceSyncing(false);
    }
  };

  // Sync session cache
  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
    localStorage.setItem("mcd_crew_session", JSON.stringify(newSession));
  };

  const handleLogout = () => {
    if (confirm("End current operations shift and log out?")) {
      setSession(null);
      localStorage.removeItem("mcd_crew_session");
    }
  };

  // State Save Wrappers (Enabling transparent persistence and history checkpoints)
  const saveProcedures = (newList: CompanyProcedure[]) => {
    const currentMap = new Map<string, CompanyProcedure>(appData.procedures.map((p) => [p.id, p]));
    const newMap = new Map<string, CompanyProcedure>(newList.map((p) => [p.id, p]));

    // Delete removed
    for (const id of currentMap.keys()) {
      if (!newMap.has(id)) {
        deleteProcedureItemDoc(id).catch(console.error);
      }
    }
    // Update added/modified
    for (const [id, value] of newMap.entries()) {
      const existing = currentMap.get(id);
      if (!existing || JSON.stringify(existing) !== JSON.stringify(value)) {
        saveProcedureItemDoc(value).catch(console.error);
      }
    }

    const updated = { ...appData, procedures: newList };
    setAppData(updated);
    saveStoredData(updated, "Updated Company Procedures Guide");
  };

  const saveInventory = (newList: InventoryItem[]) => {
    const currentMap = new Map<string, InventoryItem>(appData.inventory.map((i) => [i.id, i]));
    const newMap = new Map<string, InventoryItem>(newList.map((i) => [i.id, i]));

    for (const id of currentMap.keys()) {
      if (!newMap.has(id)) {
        deleteInventoryItemDoc(id).catch(console.error);
      }
    }
    for (const [id, value] of newMap.entries()) {
      const existing = currentMap.get(id);
      if (!existing || JSON.stringify(existing) !== JSON.stringify(value)) {
        saveInventoryItemDoc(value).catch(console.error);
      }
    }

    const updated = { ...appData, inventory: newList };
    setAppData(updated);
    saveStoredData(updated, "Calculated Stock Quantities Update");
  };

  const saveChecklist = (newList: ChecklistItem[]) => {
    const currentMap = new Map<string, ChecklistItem>(appData.checklist.map((c) => [c.id, c]));
    const newMap = new Map<string, ChecklistItem>(newList.map((c) => [c.id, c]));

    for (const id of currentMap.keys()) {
      if (!newMap.has(id)) {
        deleteChecklistItemDoc(id).catch(console.error);
      }
    }
    for (const [id, value] of newMap.entries()) {
      const existing = currentMap.get(id);
      if (!existing || JSON.stringify(existing) !== JSON.stringify(value)) {
        saveChecklistItemDoc(value).catch(console.error);
      }
    }

    const updated = { ...appData, checklist: newList };
    setAppData(updated);
    saveStoredData(updated, "Toggled Checklist Shift Duties");
  };

  const saveFeed = (newList: NewsFeedPost[]) => {
    const currentMap = new Map<string, NewsFeedPost>(appData.feed.map((f) => [f.id, f]));
    const newMap = new Map<string, NewsFeedPost>(newList.map((f) => [f.id, f]));

    for (const id of currentMap.keys()) {
      if (!newMap.has(id)) {
        deleteNewsFeedPostDoc(id).catch(console.error);
      }
    }
    for (const [id, value] of newMap.entries()) {
      const existing = currentMap.get(id);
      if (!existing || JSON.stringify(existing) !== JSON.stringify(value)) {
        saveNewsFeedPostDoc(value).catch(console.error);
      }
    }

    const updated = { ...appData, feed: newList };
    setAppData(updated);
    saveStoredData(updated, "Published Shift Notice on Feed");
  };

  const saveVideos = (newList: VideoMetadata[]) => {
    const currentMap = new Map<string, VideoMetadata>((appData.videos || []).map((v) => [v.id, v]));
    const newMap = new Map<string, VideoMetadata>(newList.map((v) => [v.id, v]));

    for (const id of currentMap.keys()) {
      if (!newMap.has(id)) {
        deleteVideoMetadataDoc(id).catch(console.error);
      }
    }
    for (const [id, value] of newMap.entries()) {
      const existing = currentMap.get(id);
      if (!existing || JSON.stringify(existing) !== JSON.stringify(value)) {
        saveVideoMetadataDoc(value).catch(console.error);
      }
    }

    const updated = { ...appData, videos: newList };
    setAppData(updated);
    saveStoredData(updated, "Saved video training guidelines to shift ledger");
  };

  // Restore DB callback (triggered from backups snapshot restoration)
  const handleBackupRestore = (restoredData: AppSchema) => {
    setAppData(restoredData);
    bulkWriteSchemaSnapshot(restoredData).catch(console.error);
  };

  // Handle Global Search row selection
  const handleSearchSelect = (type: "procedure" | "inventory" | "checklist" | "feed", originalObject: any) => {
    // Clear old highlights
    setActiveSelectedProcedure(null);
    setActiveSelectedInventory(null);
    setActiveSelectedChecklist(null);
    setActiveSelectedFeedPost(null);

    switch (type) {
      case "procedure":
        setActiveTab("procedures");
        setActiveSelectedProcedure(originalObject as CompanyProcedure);
        break;
      case "inventory":
        setActiveTab("inventory");
        setActiveSelectedInventory(originalObject as InventoryItem);
        break;
      case "checklist":
        setActiveTab("checklist");
        setActiveSelectedChecklist(originalObject as ChecklistItem);
        break;
      case "feed":
        setActiveTab("feed");
        setActiveSelectedFeedPost(originalObject as NewsFeedPost);
        break;
    }
  };

  // If no crew member is logged in, show the sleek Gold & Red credential portal
  if (!session) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const initialSyncComplete =
    initialSyncProgress.procedures &&
    initialSyncProgress.inventory &&
    initialSyncProgress.checklist &&
    initialSyncProgress.feed;

  // If logged in, but initial cloud sync is pending, show high-end operations loading gate
  if (!initialSyncComplete) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        {/* Golden glow arch background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#FFC72C]/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="w-full max-w-sm text-center z-10 space-y-6">
          {/* Logo element */}
          <div className="relative inline-flex mb-2">
            <div className="w-16 h-16 bg-[#FFC72C] rounded-2xl flex items-center justify-center font-black text-3xl text-[#DA291C] shadow-lg animate-pulse">
              <span>M</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-slate-950 flex items-center justify-center">
              <RefreshCw className="w-3 h-3 text-white animate-spin" />
            </div>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-extrabold tracking-tight">Syncing Store #4029</h1>
            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest font-bold">
              Connecting to Live Operations Database...
            </p>
          </div>

          {/* Sync checklist */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4.5 text-left space-y-2.5 font-sans">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-400 font-medium font-sans">Procedures Catalog</span>
              {initialSyncProgress.procedures ? (
                <span className="text-[#FFC72C] font-mono leading-none font-bold">✓ SYNCED</span>
              ) : (
                <span className="text-slate-500 text-[10px] uppercase font-bold animate-pulse font-mono">Syncing...</span>
              )}
            </div>
            <div className="border-t border-slate-800/60 font-sans"></div>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-400 font-medium font-sans">Spec Inventory multiplier specs</span>
              {initialSyncProgress.inventory ? (
                <span className="text-[#FFC72C] font-mono leading-none font-bold">✓ SYNCED</span>
              ) : (
                <span className="text-slate-500 text-[10px] uppercase font-bold animate-pulse font-mono">Syncing...</span>
              )}
            </div>
            <div className="border-t border-slate-800/60 font-sans"></div>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-400 font-medium font-sans">Daily checklists roster</span>
              {initialSyncProgress.checklist ? (
                <span className="text-[#FFC72C] font-mono leading-none font-bold">✓ SYNCED</span>
              ) : (
                <span className="text-slate-500 text-[10px] uppercase font-bold animate-pulse font-mono">Syncing...</span>
              )}
            </div>
            <div className="border-t border-slate-800/60 font-sans font-medium"></div>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-400 font-medium font-sans">Team news feed notices</span>
              {initialSyncProgress.feed ? (
                <span className="text-[#FFC72C] font-[#FFC72C] font-mono leading-none font-bold">✓ SYNCED</span>
              ) : (
                <span className="text-slate-500 text-[10px] uppercase font-bold animate-pulse font-mono">Syncing...</span>
              )}
            </div>
          </div>

          <div className="text-[10px] text-slate-500 leading-normal font-medium max-w-xs mx-auto font-sans">
            Authorized crew console session for <strong className="text-slate-300 font-bold">{session.username}</strong> ({session.role}). Loading assets...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 flex flex-col font-sans selection:bg-[#FFC72C] selection:text-slate-950 relative">
      
      {/* Subtle McDonald's Golden Arches Vector Watermark Background */}
      <div className="fixed inset-0 pointer-events-none select-none z-0 overflow-hidden flex items-center justify-center">
        <svg 
          className="w-[130vw] h-[130vw] sm:w-[80vw] sm:h-[80vw] md:w-[60vw] md:h-[60vw] lg:w-[45vw] lg:h-[45vw] opacity-[0.16] dark:opacity-[0.08] text-[#FFC72C] fill-current transform scale-100 transition-all duration-300" 
          viewBox="0 0 500 450" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M 64.93,391.8 C 64.93,250.2 118.8,110.4 186.2,110.4 C 238.1,110.4 259.7,185.3 259.7,249.2 C 259.7,185.3 281.3,110.4 333.2,110.4 C 400.6,110.4 454.5,250.2 454.5,391.8 L 398.9,391.8 C 398.9,286.9 367.6,163.5 333.2,163.5 C 304.7,163.5 289.4,228.6 289.4,302.3 L 289.4,391.8 L 229.9,391.8 L 229.9,302.3 C 229.9,228.6 214.6,163.5 186.2,163.5 C 151.7,163.5 120.4,286.9 120.4,391.8 L 64.93,391.8 Z" />
        </svg>
      </div>

      {/* 1. PRIMARY APP BRAND HEADER BANNER */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]" id="main-crew-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between gap-4">
          
          {/* Brand logo block */}
          <div className="flex items-center gap-3.5 shrink-0">
            <div className="w-9.5 h-9.5 bg-gradient-to-br from-[#FFD55C] to-[#FFC72C] rounded-xl flex items-center justify-center font-black text-[#DA291C] font-sans shadow-xs ring-2 ring-[#FFC72C]/10">
              <span className="text-2xl tracking-tighter leading-none select-none drop-shadow-sm">M</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xs font-black tracking-tight text-slate-900 leading-tight">M® CREW CORE</h1>
              <p className="text-[8px] text-[#DA291C] font-black tracking-widest uppercase mt-0.5">OPS SYNC ENGINE</p>
            </div>
          </div>

          {/* Core SEARCH BAR always in focus */}
          <div className="flex-1 max-w-md mx-auto">
            <SearchGlobal appData={appData} onSelectItem={handleSearchSelect} />
          </div>

          {/* Right side Metadata: Profile badge & Shift Clock */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Live syncing status badge & Force-Sync Trigger */}
            <button
              onClick={forceSync}
              disabled={isForceSyncing}
              className={`flex items-center gap-2.5 text-[10.5px] font-sans px-3.5 py-1.8 rounded-full border transition-all cursor-pointer hover:shadow-xs active:scale-95 disabled:opacity-85 disabled:cursor-not-allowed shadow-3xs ${
                syncStatus === "connected"
                  ? "text-emerald-800 bg-emerald-50/65 border-emerald-250/70 hover:bg-emerald-100/60"
                  : syncStatus === "error"
                  ? "text-blue-800 bg-blue-50/65 border-blue-200/70 hover:bg-blue-100/60"
                  : "text-amber-800 bg-amber-50/65 border-amber-200/70 hover:bg-amber-100/60"
              }`}
              title={
                isForceSyncing
                  ? "Completing full cloud database re-sync..."
                  : syncStatus === "connected" 
                  ? "Database fully synchronized. Click to re-sync manually!" 
                  : syncStatus === "error" 
                  ? "Operating safe in secure offline mode in memory. Click to re-sync!" 
                  : "Connecting to database..."
              }
            >
              {/* Healthy/Synchronized Pulsing Dot */}
              <span className="relative flex h-2 w-2 select-none">
                {syncStatus === "connected" || syncStatus === "error" ? (
                  <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${syncStatus === 'connected' ? 'bg-emerald-400' : 'bg-blue-400'}`}></span>
                ) : null}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${syncStatus === 'connected' ? 'bg-emerald-500' : syncStatus === 'error' ? 'bg-blue-500' : 'bg-amber-500 animate-pulse'}`}></span>
              </span>

              <span className="hidden sm:inline font-black tracking-tight uppercase text-[9px]">
                {isForceSyncing ? "SYNCING..." : syncStatus === "connected" ? "CLOUD SECURE" : syncStatus === "error" ? "LOCAL SYNCED" : "CONNECTING"}
              </span>

              <RefreshCw className={`w-3.5 h-3.5 text-slate-450 ${isForceSyncing ? "animate-spin text-amber-500" : ""}`} />
            </button>



            {/* Real-time UTC or Local clock */}
            <div className="hidden md:flex items-center gap-1.5 text-[11px] font-mono text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-[#DA291C]" />
              <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>

            {/* Profile badge with click logout */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 pr-3 shadow-2xs">
              <div className="w-7 h-7 rounded-lg bg-[#FFC72C]/20 border border-[#FFC72C]/40 text-[#8B6E00] flex items-center justify-center font-extrabold text-xs">
                {session.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden lg:block text-left ml-2">
                <div className="text-[10px] font-bold text-slate-700 leading-tight truncate max-w-[100px]">
                  {session.username}
                </div>
                <div className="text-[8px] text-slate-400 font-mono leading-none">
                  {session.role}
                </div>
              </div>
              
              <button
                onClick={handleLogout}
                className="ml-2.5 p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-[#DA291C] transition-colors cursor-pointer"
                title="Log out of shift"
                id="header-logout-btn"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* EMERGENCY DATABASE SEED BANNER FOR HELPING USERS WITH EMPTY DATABASES */}
      {(appData.inventory.length === 0 || appData.procedures.length === 0) && (
        <div className="bg-amber-50 border-b border-amber-200 py-3 px-4 shadow-3xs" id="empty-db-setup-banner">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <Sparkles className="w-5 h-5 text-[#DA291C] shrink-0 mt-0.5 sm:mt-0 animate-pulse" />
              <div>
                <p className="text-xs font-bold text-slate-850">
                  First-Time Cloud Database Setup Required
                </p>
                <p className="text-[10px] text-slate-500">
                  Your store database is currently active but holds no procedures or inventory multiplier specs. Seed the default McDonald's catalog profiles to populate specs instantly!
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (confirm("🚨 Seed Cloud Catalog: This will write the standard McDonald's operations specifications, task checklists, and kitchen procedures onto your live cloud database. Proceed?")) {
                  const defaults = resetDatabaseToDefault();
                  handleBackupRestore(defaults);
                }
              }}
              className="bg-[#DA291C] hover:bg-[#C21B10] text-white font-extrabold px-4.5 py-1.5 rounded-lg text-xs select-none shadow-sm transition-all shrink-0 cursor-pointer text-center"
              id="empty-db-seed-btn"
            >
              Seed McDonald's Spec Sheet
            </button>
          </div>
        </div>
      )}

      {/* 2. TAB SELECTION RIBBON */}
      <div className="bg-white border-b border-slate-201 sticky top-14 z-30" id="tabs-ribbon-bar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1.5 py-2 overflow-x-auto no-scrollbar scroll-smooth">
            
            {/* tab: Dashboard */}
            <button
              id="tab-dashboard-trigger"
              onClick={() => {
                setActiveTab("dashboard");
              }}
              className={`flex items-center gap-2 text-xs font-semibold px-4 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-[#FFC72C]/15 text-[#8B6E00] border border-[#FFC72C]/30 shadow-xs font-extrabold"
                  : "bg-transparent border border-transparent text-slate-500 hover:bg-slate-55 hover:text-slate-800"
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0 text-[#DA291C]" />
              Dashboard
            </button>

            {/* tab: Procedures */}
            <button
              id="tab-procedures-trigger"
              onClick={() => {
                setActiveTab("procedures");
                setActiveSelectedProcedure(null);
              }}
              className={`flex items-center gap-2 text-xs font-semibold px-4 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer ${
                activeTab === "procedures"
                  ? "bg-[#FFC72C]/15 text-[#8B6E00] border border-[#FFC72C]/30 shadow-xs"
                  : "bg-transparent border border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              Procedures
            </button>

            {/* tab: Inventory */}
            <button
              id="tab-inventory-trigger"
              onClick={() => {
                setActiveTab("inventory");
                setActiveSelectedInventory(null);
              }}
              className={`flex items-center gap-2 text-xs font-semibold px-4 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer ${
                activeTab === "inventory"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs"
                  : "bg-transparent border border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Warehouse className="w-4 h-4 shrink-0" />
              Inventory
            </button>

            {/* tab: Checklists */}
            <button
              id="tab-checklist-trigger"
              onClick={() => {
                setActiveTab("checklist");
                setActiveSelectedChecklist(null);
              }}
              className={`flex items-center gap-2 text-xs font-semibold px-4 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer ${
                activeTab === "checklist"
                  ? "bg-blue-50 text-blue-850 border border-blue-200 shadow-xs dark:bg-amber-450/10 dark:text-amber-400 dark:border-amber-900"
                  : "bg-transparent border border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <CheckSquare className="w-4 h-4 shrink-0 text-[#DA291C]" />
              Daily System
            </button>

            {/* tab: News Feed */}
            <button
              id="tab-feed-trigger"
              onClick={() => {
                setActiveTab("feed");
              }}
              className={`flex items-center gap-2 text-xs font-semibold px-4 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer ${
                activeTab === "feed"
                  ? "bg-rose-50 text-[#DA291C] border border-rose-100 shadow-xs"
                  : "bg-transparent border border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              News Feed
            </button>

            {/* tab: Backups Security */}
            <button
              id="tab-backups-trigger"
              onClick={() => {
                setActiveTab("backups");
              }}
              className={`flex items-center gap-2 text-xs font-semibold px-4 py-1.5 rounded-lg transition-all shrink-0 ml-auto cursor-pointer ${
                activeTab === "backups"
                  ? "bg-slate-100 border border-slate-300 text-slate-700 font-bold shadow-xs"
                  : "bg-transparent border border-transparent text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              }`}
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              Operational Security
            </button>

          </nav>
        </div>
      </div>

      {/* 3. PRIMARY CONTENT LAYOUT STAGE */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            id="tab-grid-viewport"
          >
            {activeTab === "dashboard" && (
              <DashboardPanel
                appData={appData}
                currentSession={session}
                onTabChange={(tab) => {
                  setActiveTab(tab);
                  document.getElementById("tabs-ribbon-bar")?.scrollIntoView({ behavior: "smooth" });
                }}
                onOpenVideoHub={() => setIsVideoHubOpen(true)}
              />
            )}

            {activeTab === "procedures" && (
              <ProceduresPanel
                procedures={appData.procedures}
                currentSession={session}
                activeSelectedProcedure={activeSelectedProcedure}
                onSave={saveProcedures}
              />
            )}

            {activeTab === "inventory" && (
              <InventoryPanel
                inventory={appData.inventory}
                currentSession={session}
                activeSelectedInventory={activeSelectedInventory}
                onSave={saveInventory}
              />
            )}

            {activeTab === "checklist" && (
              <DailySystemPanel
                checklist={appData.checklist}
                currentSession={session}
                activeSelectedChecklist={activeSelectedChecklist}
                onSave={saveChecklist}
                onOpenVideoHub={() => setIsVideoHubOpen(true)}
              />
            )}

            {activeTab === "feed" && (
              <NewsFeedPanel
                feed={appData.feed}
                currentSession={session}
                onSave={saveFeed}
                activeSelectedFeedPost={activeSelectedFeedPost}
                videos={appData.videos || []}
                onSaveVideos={saveVideos}
              />
            )}

            {activeTab === "backups" && (
              <BackupsPanel
                appData={appData}
                onRestoreSuccess={handleBackupRestore}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 4. FOOTER LINE */}
      <footer className="bg-slate-800 border-t border-slate-700 py-3 text-center text-[10px] text-slate-400 shrink-0 uppercase tracking-widest">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex gap-4 items-center">
            <span className="w-1.5 h-1.5 bg-[#FFC72C] rounded-full"></span>
            <span>STORE #4029 - CHICAGO MAIN</span>
          </div>
          <span>OPERATOR PORTAL • SECURE OFFLINE CLOUD RECOVERY • VERSION 2.4.1-STABLE</span>
        </div>
      </footer>

      {session && (
        <WorkstationApp
          isOpen={isVideoHubOpen}
          onClose={() => setIsVideoHubOpen(false)}
          videos={appData.videos || []}
          currentSession={session}
          onSaveVideos={saveVideos}
        />
      )}

    </div>
  );
}
