/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UserSession, AppSchema, CompanyProcedure, InventoryItem, ChecklistItem, NewsFeedPost } from "./types";
import { getStoredData, saveStoredData } from "./data/storageEngine";
import {
  seedFirestoreIfNeeded,
  subscribeToAppSchema,
  saveProcedureItemDoc,
  deleteProcedureItemDoc,
  saveInventoryItemDoc,
  deleteInventoryItemDoc,
  saveChecklistItemDoc,
  deleteChecklistItemDoc,
  saveNewsFeedPostDoc,
  deleteNewsFeedPostDoc,
  bulkWriteSchemaSnapshot
} from "./data/firebaseSync";
import Login from "./components/Login";
import SearchGlobal from "./components/SearchGlobal";
import ProceduresPanel from "./components/ProceduresPanel";
import InventoryPanel from "./components/InventoryPanel";
import ChecklistsPanel from "./components/ChecklistsPanel";
import NewsFeedPanel from "./components/NewsFeedPanel";
import BackupsPanel from "./components/BackupsPanel";

import {
  BookOpen, Warehouse, CheckSquare, MessageSquare, ShieldAlert,
  LogOut, Clock, UserCheck, Sparkles, ChefHat, Salad
} from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"procedures" | "inventory" | "checklist" | "feed" | "backups">("procedures");
  
  // Real-time Clock State
  const [currentTime, setCurrentTime] = useState(new Date());

  // Search-linked active structures (for opening editors directly)
  const [activeSelectedProcedure, setActiveSelectedProcedure] = useState<CompanyProcedure | null>(null);
  const [activeSelectedInventory, setActiveSelectedInventory] = useState<InventoryItem | null>(null);
  const [activeSelectedChecklist, setActiveSelectedChecklist] = useState<ChecklistItem | null>(null);

  // Update Clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Cloud Synchronization
  useEffect(() => {
    let unsub: (() => void) | null = null;
    
    const initSync = async () => {
      await seedFirestoreIfNeeded();
      unsub = subscribeToAppSchema(
        (updatedChunks) => {
          setAppData((prev) => ({ ...prev, ...updatedChunks }));
        },
        (err) => {
          console.error("Firebase sync error inside main view context:", err);
        }
      );
    };

    initSync();

    return () => {
      if (unsub) unsub();
    };
  }, []);

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
        // Simply scrolls to the top or focuses feed
        break;
    }
  };

  // If no crew member is logged in, show the sleek Gold & Red credential portal
  if (!session) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#F4F4F5] text-slate-900 flex flex-col font-sans selection:bg-[#FFC72C] selection:text-slate-950">
      
      {/* 1. PRIMARY APP BRAND HEADER BANNER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm" id="main-crew-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          
          {/* Brand logo block */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 bg-[#FFC72C] rounded-md flex items-center justify-center font-black text-[#DA291C] font-sans shadow-sm">
              <span className="text-xl tracking-tighter leading-none select-none">M</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-extrabold tracking-tight text-slate-800 leading-tight">M-OPS</h1>
              <p className="text-[9px] text-slate-400 font-sans tracking-widest font-semibold uppercase">OPERATIONS MANAGER</p>
            </div>
          </div>

          {/* Core SEARCH BAR always in focus */}
          <div className="flex-1 max-w-lg mx-auto">
            <SearchGlobal appData={appData} onSelectItem={handleSearchSelect} />
          </div>

          {/* Right side Metadata: Profile badge & Shift Clock */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
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

      {/* 2. TAB SELECTION RIBBON */}
      <div className="bg-white border-b border-slate-200 sticky top-14 z-30" id="tabs-ribbon-bar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1.5 py-2 overflow-x-auto no-scrollbar scroll-smooth">
            
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
                  ? "bg-blue-50 text-blue-800 border border-blue-200 shadow-xs"
                  : "bg-transparent border border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <CheckSquare className="w-4 h-4 shrink-0" />
              Daily Checklist
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
              <ChecklistsPanel
                checklist={appData.checklist}
                currentSession={session}
                activeSelectedChecklist={activeSelectedChecklist}
                onSave={saveChecklist}
              />
            )}

            {activeTab === "feed" && (
              <NewsFeedPanel
                feed={appData.feed}
                currentSession={session}
                onSave={saveFeed}
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

    </div>
  );
}
