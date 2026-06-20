/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { AppSchema, UserSession } from "../types";
import { 
  ExternalLink, LogIn, ShieldCheck, Sparkles, Building, Info, Check, 
  HelpCircle, Eye, EyeOff, AlertCircle, Bookmark, Globe, ArrowRight,
  ListChecks, Warehouse, BookOpen, MessageSquare, Lock, HelpCircle as HelpIcon
} from "lucide-react";

interface DashboardPanelProps {
  appData: AppSchema;
  currentSession: UserSession;
  onTabChange: (tab: "procedures" | "inventory" | "checklist" | "feed" | "backups") => void;
}

export default function DashboardPanel({ appData, currentSession, onTabChange }: DashboardPanelProps) {
  // Saudi Riyadh SuccessFactors Link
  const targetUrl = "https://performancemanager.successfactors.eu/sf/home?bplte_company=riyadhinte&_s.crb=rWkjTIBD9a4RaObr4TRpXEX8Bd2gKpiiI3TCBHRDts8%253d";

  // Login form interactive simulation states
  const [employeeId, setEmployeeId] = useState(currentSession.username ? currentSession.username.replace(/\s+/g, "").toLowerCase() : "");
  const [password, setPassword] = useState("••••••••");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [saveCredentials, setSaveCredentials] = useState(true);

  const handleLaunchPortal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim()) {
      setErrorMsg("Please enter your registered SAHL Employee ID or Username.");
      return;
    }
    setErrorMsg(null);
    setIsRedirecting(true);
    
    // Simulate high-security handshakes
    setTimeout(() => {
      setIsRedirecting(false);
      // Securely open in a clean physical external tab window
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }, 900);
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* 1. HERO BRANDING HEADER WITH SAUDI PALM & ARMS STYLING */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-850 to-emerald-950 rounded-3xl p-6 md:p-8 text-white shadow-xl border border-emerald-900/40">
        
        {/* Decorative Golden Arches and Saudi Riyadh Elements */}
        <div className="absolute top-0 right-0 w-80 h-80 border-[20px] border-amber-400/10 rounded-full translate-x-20 -translate-y-20 pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-80 border-[1px] border-amber-400/20 rounded-full translate-x-12 -translate-y-12 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          
          <div className="space-y-3.5 max-w-xl text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-widest">
              <Globe className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Unified Saudi SAP Network
            </div>
            
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-none text-white font-sans">
              SAHL <span className="text-amber-400">PORTAL</span>
            </h1>
            
            <p className="text-xs sm:text-xs text-slate-300 leading-relaxed font-sans font-medium">
              Welcome to the Riyadh International Catering Co. (RICC) Human Resources & SuccessFactors Hub. Log on securely to access salary statements, career planning, operational performance feedback, and personnel schedules.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-1.5 text-[11px] text-slate-400 font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Riyadh RICC Node</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Single Sign-On (SSO) Active</span>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row items-stretch lg:items-center gap-3">
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:from-amber-300 hover:to-amber-400 transition-all cursor-pointer shadow-md select-none transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <ExternalLink className="w-4 h-4 text-slate-950 font-black" />
              Direct SuccessFactors Link
            </a>
          </div>

        </div>
      </div>

      {/* 2. OPERATIONAL MODULES WORKSTATIONS (BIGGER APPLET SHORTCUTS WITH MCDONALD'S WATERMARK BACKGROUND) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pl-1">
          <div className="space-y-1 text-left">
            <h2 className="text-lg font-black text-slate-850 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-6 bg-[#DA291C] rounded-full inline-block" />
              Store Applet Workstations
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium font-sans">
              Access real-time operation consoles, checklists, inventory audits, and procedural guidelines.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* CARD 1: CHECKLIST OPERATIONS */}
          <motion.div
            whileHover={{ scale: 1.015, translateY: -2 }}
            transition={{ duration: 0.2 }}
            className="group relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800 rounded-[2rem] p-6 sm:p-8 shadow-[0_12px_36px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_48px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_20px_48px_rgba(0,0,0,0.35)] transition-all flex flex-col justify-between min-h-[300px] text-left"
          >
            {/* Background McDonald's watermark inside card */}
            <div className="absolute right-[-40px] bottom-[-40px] w-56 h-56 opacity-[0.035] dark:opacity-[0.015] text-[#FFC72C] fill-current pointer-events-none group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 select-none">
              <svg viewBox="0 0 500 450" className="w-full h-full">
                <path d="M 64.93,391.8 C 64.93,250.2 118.8,110.4 186.2,110.4 C 238.1,110.4 259.7,185.3 259.7,249.2 C 259.7,185.3 281.3,110.4 333.2,110.4 C 400.6,110.4 454.5,250.2 454.5,391.8 L 398.9,391.8 C 398.9,286.9 367.6,163.5 333.2,163.5 C 304.7,163.5 289.4,228.6 289.4,302.3 L 289.4,391.8 L 229.9,391.8 L 229.9,302.3 C 229.9,228.6 214.6,163.5 186.2,163.5 C 151.7,163.5 120.4,286.9 120.4,391.8 L 64.93,391.8 Z" />
              </svg>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 bg-red-50 dark:bg-red-950/20 text-[#DA291C] rounded-2xl flex items-center justify-center ring-4 ring-red-500/5 group-hover:scale-110 transition-transform">
                  <ListChecks className="w-7 h-7" />
                </div>
                <span className="px-3.5 py-1 rounded-full bg-red-100 dark:bg-rose-950/30 text-[#DA291C] dark:text-red-400 text-[10px] font-black uppercase tracking-widest font-mono">
                  Active Shift Log
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-slate-850 dark:text-white uppercase tracking-tight">
                  Start Shift Checklists
                </h3>
                <p className="text-xs sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans font-medium">
                  Perform critical opening protocol steps, verify product holds, record food safety core temperatures, and complete shift handovers.
                </p>
              </div>

              {/* Progress and mini KPI */}
              <div className="pt-3 pb-2 space-y-2 text-left">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <span className="uppercase tracking-wider font-mono">Tasks Progress</span>
                  <span className="font-mono">{appData.checklist.filter(c => c.completed).length} / {appData.checklist.length} Completed</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-850 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-red-500 to-[#DA291C] rounded-full transition-all duration-500" 
                    style={{ width: `${(appData.checklist.filter(c => c.completed).length / Math.max(1, appData.checklist.length)) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => onTabChange("checklist")}
              className="mt-6 w-full bg-[#DA291C] hover:bg-slate-900 dark:hover:bg-amber-400 text-white dark:hover:text-slate-900 py-3.5 px-6 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md select-none transform group-hover:translate-x-1"
            >
              Launch Shift Checklist
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </motion.div>

          {/* CARD 2: INVENTORY AUDITOR */}
          <motion.div
            whileHover={{ scale: 1.015, translateY: -2 }}
            transition={{ duration: 0.2 }}
            className="group relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800 rounded-[2rem] p-6 sm:p-8 shadow-[0_12px_36px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_48px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_20px_48px_rgba(0,0,0,0.35)] transition-all flex flex-col justify-between min-h-[300px] text-left"
          >
            {/* Background McDonald's watermark inside card */}
            <div className="absolute right-[-40px] bottom-[-40px] w-56 h-56 opacity-[0.035] dark:opacity-[0.015] text-[#FFC72C] fill-current pointer-events-none group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 select-none">
              <svg viewBox="0 0 500 450" className="w-full h-full">
                <path d="M 64.93,391.8 C 64.93,250.2 118.8,110.4 186.2,110.4 C 238.1,110.4 259.7,185.3 259.7,249.2 C 259.7,185.3 281.3,110.4 333.2,110.4 C 400.6,110.4 454.5,250.2 454.5,391.8 L 398.9,391.8 C 398.9,286.9 367.6,163.5 333.2,163.5 C 304.7,163.5 289.4,228.6 289.4,302.3 L 289.4,391.8 L 229.9,391.8 L 229.9,302.3 C 229.9,228.6 214.6,163.5 186.2,163.5 C 151.7,163.5 120.4,286.9 120.4,391.8 L 64.93,391.8 Z" />
              </svg>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-2xl flex items-center justify-center ring-4 ring-emerald-500/5 group-hover:scale-110 transition-transform">
                  <Warehouse className="w-7 h-7" />
                </div>
                <span className="px-3.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest font-mono">
                  Live Stock Audit
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-slate-850 dark:text-white uppercase tracking-tight">
                  Audit Restaurant Stock
                </h3>
                <p className="text-xs sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans font-medium">
                  Count raw coolers, dry store items, beverage syrup canisters, and packaging cases. Track conversion packages and generate direct stock level reviews.
                </p>
              </div>

              {/* Progress and mini KPI */}
              <div className="pt-3 pb-2 space-y-2 text-left">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <span className="uppercase tracking-wider font-mono">ITEMS CLASSIFIED</span>
                  <span className="font-mono">{appData.inventory.length} Registered Items</span>
                </div>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 font-sans">
                  ✓ Full sync active with RICC Central Riyadh warehouses
                </p>
              </div>
            </div>

            <button
              onClick={() => onTabChange("inventory")}
              className="mt-6 w-full bg-emerald-600 hover:bg-slate-900 dark:hover:bg-emerald-500 text-white py-3.5 px-6 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md select-none transform group-hover:translate-x-1"
            >
              Audit Inventory
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </motion.div>

          {/* CARD 3: STANDARD PROCEDURES SOP */}
          <motion.div
            whileHover={{ scale: 1.015, translateY: -2 }}
            transition={{ duration: 0.2 }}
            className="group relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800 rounded-[2rem] p-6 sm:p-8 shadow-[0_12px_36px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_48px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_20px_48px_rgba(0,0,0,0.35)] transition-all flex flex-col justify-between min-h-[300px] text-left"
          >
            {/* Background McDonald's watermark inside card */}
            <div className="absolute right-[-40px] bottom-[-40px] w-56 h-56 opacity-[0.035] dark:opacity-[0.015] text-[#FFC72C] fill-current pointer-events-none group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 select-none">
              <svg viewBox="0 0 500 450" className="w-full h-full">
                <path d="M 64.93,391.8 C 64.93,250.2 118.8,110.4 186.2,110.4 C 238.1,110.4 259.7,185.3 259.7,249.2 C 259.7,185.3 281.3,110.4 333.2,110.4 C 400.6,110.4 454.5,250.2 454.5,391.8 L 398.9,391.8 C 398.9,286.9 367.6,163.5 333.2,163.5 C 304.7,163.5 289.4,228.6 289.4,302.3 L 289.4,391.8 L 229.9,391.8 L 229.9,302.3 C 229.9,228.6 214.6,163.5 186.2,163.5 C 151.7,163.5 120.4,286.9 120.4,391.8 L 64.93,391.8 Z" />
              </svg>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-2xl flex items-center justify-center ring-4 ring-amber-500/5 group-hover:scale-110 transition-transform">
                  <BookOpen className="w-7 h-7" />
                </div>
                <span className="px-3.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest font-mono">
                  Standard Guides
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-slate-850 dark:text-white uppercase tracking-tight">
                  SOP &amp; Operational Codes
                </h3>
                <p className="text-xs sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans font-medium">
                  Browse company standard operating procedures (SOP), food preparation guidelines, equipment calibration parameters, and customer-focus safety rules.
                </p>
              </div>

              {/* Progress and mini KPI */}
              <div className="pt-3 pb-2 space-y-2 text-left">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <span className="uppercase tracking-wider font-mono">GUIDES PUBLISHED</span>
                  <span className="font-mono">{appData.procedures.length} Active Guides</span>
                </div>
                <p className="text-[11px] text-amber-600 dark:text-amber-450 font-bold flex items-center gap-1 font-sans">
                  ★ Standard McDonald's Gold Standard Roster Active
                </p>
              </div>
            </div>

            <button
              onClick={() => onTabChange("procedures")}
              className="mt-6 w-full bg-amber-500 hover:bg-slate-900 dark:hover:bg-amber-400 text-slate-900 hover:text-white dark:hover:text-slate-900 py-3.5 px-6 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md select-none transform group-hover:translate-x-1"
            >
              Browse SOP Codes
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </motion.div>

          {/* CARD 4: RESTAURANT NEWS FEED */}
          <motion.div
            whileHover={{ scale: 1.015, translateY: -2 }}
            transition={{ duration: 0.2 }}
            className="group relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/85 dark:border-slate-800 rounded-[2rem] p-6 sm:p-8 shadow-[0_12px_36px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_48px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_20px_48px_rgba(0,0,0,0.35)] transition-all flex flex-col justify-between min-h-[300px] text-left"
          >
            {/* Background McDonald's watermark inside card */}
            <div className="absolute right-[-40px] bottom-[-40px] w-56 h-56 opacity-[0.035] dark:opacity-[0.015] text-[#FFC72C] fill-current pointer-events-none group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 select-none">
              <svg viewBox="0 0 500 450" className="w-full h-full">
                <path d="M 64.93,391.8 C 64.93,250.2 118.8,110.4 186.2,110.4 C 238.1,110.4 259.7,185.3 259.7,249.2 C 259.7,185.3 281.3,110.4 333.2,110.4 C 400.6,110.4 454.5,250.2 454.5,391.8 L 398.9,391.8 C 398.9,286.9 367.6,163.5 333.2,163.5 C 304.7,163.5 289.4,228.6 289.4,302.3 L 289.4,391.8 L 229.9,391.8 L 229.9,302.3 C 229.9,228.6 214.6,163.5 186.2,163.5 C 151.7,163.5 120.4,286.9 120.4,391.8 L 64.93,391.8 Z" />
              </svg>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-14 h-14 bg-blue-50 dark:bg-blue-950/20 text-blue-650 rounded-2xl flex items-center justify-center ring-4 ring-blue-500/5 group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <span className="px-3.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest font-mono">
                  Store Discussion
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-slate-850 dark:text-white uppercase tracking-tight">
                  RICC News Announcements
                </h3>
                <p className="text-xs sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-sans font-medium">
                  Stay updated with official bulletins, food safety campaign alerts, team member promotions, and regional district announcements.
                </p>
              </div>

              {/* Progress and mini KPI */}
              <div className="pt-3 pb-2 space-y-2 text-left">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <span className="uppercase tracking-wider font-mono">POSTS LOGGED</span>
                  <span className="font-mono">{appData.feed.length} Crew Postings</span>
                </div>
                <p className="text-[11px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 font-sans">
                  💬 Real-time commenting &amp; crew alignment board
                </p>
              </div>
            </div>

            <button
              onClick={() => onTabChange("feed")}
              className="mt-6 w-full bg-blue-600 hover:bg-slate-900 dark:hover:bg-blue-500 text-white py-3.5 px-6 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md select-none transform group-hover:translate-x-1"
            >
              Read Announcements
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </motion.div>

        </div>

      </div>

    </div>
  );
}
