/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { BackupSnapshot, AppSchema } from "../types";
import { getBackupsList, restoreBackup, createAutomatedBackup, resetDatabaseToDefault } from "../data/storageEngine";
import {
  ShieldAlert, RefreshCw, Save, Download, Upload, AlertCircle, CheckCircle, RotateCcw
} from "lucide-react";

interface BackupsPanelProps {
  appData: AppSchema;
  onRestoreSuccess: (restoredData: AppSchema) => void;
}

export default function BackupsPanel({ appData, onRestoreSuccess }: BackupsPanelProps) {
  const [backups, setBackups] = useState<BackupSnapshot[]>(() => getBackupsList());
  const [backupDesc, setBackupDesc] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleManualBackup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupDesc.trim()) return;

    const list = createAutomatedBackup(appData, `User snapshot: ${backupDesc.trim()}`);
    setBackups(list);
    setBackupDesc("");
    triggerNotification("Manual data backup archive stamped successfully");
  };

  const handleRestore = (id: string, description: string) => {
    if (confirm(`Do you want to restore the database to: "${description}"? State changes since then will be overwritten.`)) {
      const restored = restoreBackup(id);
      if (restored) {
        onRestoreSuccess(restored);
        triggerNotification("Database restored. State rolls back successfully.");
      } else {
        setErrorMsg("Failed to recover that state.");
      }
    }
  };

  const triggerNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  // Export JSON file download
  const handleExportJSON = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `mcd_crew_backup_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      triggerNotification("Downloaded offline JSON backup successfully");
    } catch {
      setErrorMsg("Failed to export backup JSON file.");
    }
  };

  // Import JSON file upload
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.procedures && parsed.inventory && parsed.checklist && parsed.feed) {
          const list = createAutomatedBackup(parsed, "JSON Import Restore Anchor");
          onRestoreSuccess(parsed);
          setBackups(list);
          triggerNotification("Restored and synchronized fully from custom JSON backup.");
        } else {
          setErrorMsg("Selected JSON doesn't match the database format schema.");
        }
      } catch {
        setErrorMsg("Invalid JSON file. Please try a valid operations export JSON.");
      }
    };
    reader.readAsText(file);
  };

  const handleResetDefaults = () => {
    if (confirm("🚨 WARNING: This resets all custom edits to the original default raw cooler, freezer, checklists, and procedures. All custom entries will be saved inside backups history but current view will return to defaults. Proceed?")) {
      const defaults = resetDatabaseToDefault();
      onRestoreSuccess(defaults);
      setBackups(getBackupsList());
      triggerNotification("Returned database state to initial factory setup.");
    }
  };

  return (
    <div className="space-y-4 font-sans max-w-3xl mx-auto" id="backups-portal-panel">
      {/* HEADER SECTION */}
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
          <ShieldAlert className="w-4.5 h-4.5 text-[#DA291C]" />
          Shift Data Protection &amp; History Recovery
        </h2>
        <p className="text-slate-400 text-[10px] sm:text-xs">
          Automatic snapshots trace every procedure and quantity change. Guard against accidental loss or sync cross-device.
        </p>
      </div>

      {/* FEEDBACK LABELS */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 text-xs py-2.5 px-3 rounded-xl flex items-center gap-2 font-bold shadow-3xs animate-fade-in">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-250 text-rose-800 text-xs py-2.5 px-3 rounded-xl flex items-center gap-2 font-bold shadow-3xs animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* MANUAL BACKUP STATE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Take custom snapshot */}
        <form onSubmit={handleManualBackup} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5 shadow-2xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Create Manual Backup Milestone
          </h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Record a named snapshot of procedures, checklists, and food stocks before starting a massive shift change or hand-off.
          </p>
          <div className="space-y-2.5">
            <input
              type="text"
              required
              id="backup-desc-input"
              value={backupDesc}
              onChange={(e) => setBackupDesc(e.target.value)}
              placeholder="e.g. Completed Monday Grill Temp Audit Check"
              className="w-full bg-slate-50 border border-slate-250/85 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-[4px] focus:outline-[#FFC72C] focus:bg-white transition-all font-sans"
            />
            <button
              type="submit"
              className="w-full bg-[#DA291C] hover:bg-[#C21B10] text-[#FFFFFF] text-xs font-bold py-1.5 rounded-lg cursor-pointer transition-colors"
              id="trigger-manual-backup"
            >
              Stamp Snapshot Now
            </button>
          </div>
        </form>

        {/* Offline sync & Backup JSON actions */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 flex flex-col justify-between shadow-2xs">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
              Cross-Device Synchronization &amp; JSON Offline File
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Export your current database as a local file, or upload the JSON to mirror the identical procedures and counts to a co-worker's phone.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExportJSON}
              className="flex items-center justify-center gap-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold cursor-pointer transition-colors"
              id="export-json-btn"
            >
              <Download className="w-3.5 h-3.5 text-[#DA291C]" />
              Export Database
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold cursor-pointer transition-colors"
              id="import-json-btn"
            >
              <Upload className="w-3.5 h-3.5 text-[#DA291C]" />
              Import Database
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* TIMELINE OF BACKUPS snapshots */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5 shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Automated Backups Timeline ({backups.length}/15 logs)
          </h3>
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1 text-[9px] text-[#DA291C] hover:underline uppercase font-bold cursor-pointer"
            id="reset-factory-defaults-btn"
          >
            <RotateCcw className="w-3 h-3" />
            Reset Defaults
          </button>
        </div>

        {backups.length === 0 ? (
          <p className="p-4 text-xs text-slate-400 text-center">No snapshot history stamp available.</p>
        ) : (
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
            {backups.map((snap) => (
              <div key={snap.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                <div className="min-w-0 space-y-0.5">
                  <div className="font-bold text-slate-750 line-clamp-1">{snap.description}</div>
                  <div className="text-[9px] text-slate-450 font-mono">
                    {new Date(snap.timestamp).toLocaleString()} • ID: {snap.id}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRestore(snap.id, snap.description)}
                  className="bg-slate-50 hover:bg-[#FFC72C]/10 border border-slate-300 text-slate-700 hover:text-[#8B6E00] hover:border-[#FFC72C]/50 font-bold px-3 py-1 rounded-lg text-[10px] sm:text-xs cursor-pointer select-none transition-all shadow-3xs"
                  id={`restore-btn-${snap.id}`}
                >
                  Restore State
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
