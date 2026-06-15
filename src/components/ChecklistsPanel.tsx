/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ChecklistItem, UserSession } from "../types";
import {
  CheckSquare, Plus, Edit3, Trash2, Save, Undo, Check, ToggleLeft, X, Search
} from "lucide-react";
import SecurityModal from "./SecurityModal";

interface ChecklistsPanelProps {
  checklist: ChecklistItem[];
  currentSession: UserSession;
  activeSelectedChecklist: ChecklistItem | null; // For search-to-edit focus
  onSave: (checklistList: ChecklistItem[]) => void;
}

export default function ChecklistsPanel({
  checklist,
  currentSession,
  activeSelectedChecklist,
  onSave
}: ChecklistsPanelProps) {
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState("");

  // Editor Inline States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editCategory, setEditCategory] = useState<ChecklistItem["category"]>("Opening");

  // New Item Input State
  const [newTaskText, setNewTaskText] = useState("");
  const [newCategory, setNewCategory] = useState<ChecklistItem["category"]>("Opening");
  const [showAddForm, setShowAddForm] = useState(false);

  // Security Modal States
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [securityModalTitle, setSecurityModalTitle] = useState("");
  const [securityModalMessage, setSecurityModalMessage] = useState("");
  const [securityModalRequirePin, setSecurityModalRequirePin] = useState(false);
  const [securityModalOnConfirm, setSecurityModalOnConfirm] = useState<(() => void) | null>(null);

  const requestConfirmation = (
    title: string,
    message: string,
    requirePin: boolean,
    onConfirm: () => void
  ) => {
    setSecurityModalTitle(title);
    setSecurityModalMessage(message);
    setSecurityModalRequirePin(requirePin);
    setSecurityModalOnConfirm(() => () => {
      onConfirm();
      setSecurityModalOpen(false);
    });
    setSecurityModalOpen(true);
  };

  // Focus Search Selected Checklist Item
  React.useEffect(() => {
    if (activeSelectedChecklist) {
      setEditingId(activeSelectedChecklist.id);
      setEditText(activeSelectedChecklist.task);
      setEditCategory(activeSelectedChecklist.category);
    }
  }, [activeSelectedChecklist]);

  const categories: ("All" | ChecklistItem["category"])[] = [
    "All",
    "Opening",
    "Shift Handover",
    "Closing",
    "Food Safety"
  ];

  const handleToggle = (id: string) => {
    const updated = checklist.map(item => {
      if (item.id === id) {
        const completed = !item.completed;
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return {
          ...item,
          completed,
          completedBy: completed ? currentSession.username : undefined,
          timeCompleted: completed ? now : undefined
        };
      }
      return item;
    });
    onSave(updated);
  };

  const handleAddNewTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    requestConfirmation(
      "Create Duty Task",
      "Are you sure you want to append this new item to the active operational checklists? Operational PIN confirmation is required.",
      true, // requirePin = true!
      () => {
        const newTask: ChecklistItem = {
          id: "chk_" + Date.now(),
          task: newTaskText.trim(),
          category: newCategory,
          completed: false
        };

        onSave([newTask, ...checklist]);
        setNewTaskText("");
        setShowAddForm(false);
      }
    );
  };

  const startEdit = (item: ChecklistItem) => {
    setEditingId(item.id);
    setEditText(item.task);
    setEditCategory(item.category);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editText.trim()) return;

    requestConfirmation(
      "Confirm Duty Edit",
      "Are you sure you want to save modifications to this checklist chore? Security PIN verification is required.",
      true, // requirePin = true
      () => {
        const updated = checklist.map(item => {
          if (item.id === editingId) {
            return {
              ...item,
              task: editText.trim(),
              category: editCategory
            };
          }
          return item;
        });

        onSave(updated);
        setEditingId(null);
      }
    );
  };

  const handleDelete = (id: string) => {
    requestConfirmation(
      "Remove Checklist Task",
      "Are you sure you want to delete this duty checklist item permanently from the system database? Security PIN verification is required.",
      true, // requirePin = true!
      () => {
        const updated = checklist.filter(item => item.id !== id);
        onSave(updated);
        setEditingId(null);
      }
    );
  };

  const handleResetAll = () => {
    requestConfirmation(
      "Reset All Checklists",
      "Are you sure you want to reset completions on all tasks for the next shift? This operation cannot be undone.",
      false, // requirePin = false (standard confirmation overlay is fine)
      () => {
        const updated = checklist.map(item => ({
          ...item,
          completed: false,
          completedBy: undefined,
          timeCompleted: undefined
        }));
        onSave(updated);
      }
    );
  };

  const filtered = checklist.filter(item => {
    const matchesCategory = filterCategory === "All" || item.category === filterCategory;
    const matchesSearch = item.task.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-4 font-sans">
      
      {/* PANEL HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <CheckSquare className="w-4.5 h-4.5 text-[#DA291C]" />
            Operational Shift Checklists
          </h2>
          <p className="text-slate-500 text-[10px] sm:text-xs">
            Log raw cooler temps, check fry cooks, stamp closing handovers. Everything is fully editable.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetAll}
            className="bg-white border border-slate-200 text-slate-505 hover:bg-slate-50 hover:text-slate-800 px-3 py-1.5 rounded-lg text-xs font-semibold select-none cursor-pointer transition-colors"
            id="reset-checklists-btn"
          >
            Clear Shift Statuses
          </button>
          
          <button
            onClick={() => setShowAddForm(prev => !prev)}
            id="toggle-add-checklist-btn"
            className="flex items-center gap-1 bg-[#DA291C] hover:bg-[#C21B10] text-white font-extrabold px-3 py-1.5 rounded-lg text-xs select-none transition-all cursor-pointer shadow-xs border border-transparent"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Checklist Duty
          </button>
        </div>
      </div>

      {/* QUICK ADD FORM */}
      {showAddForm && (
        <form onSubmit={handleAddNewTask} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4 shadow-2xs">
          <div className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1">
            New Checklist Duty Specifications
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <input
                type="text"
                required
                id="new-checklist-task"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="e.g. Scrape grill grease vents, record temperatures..."
                className="w-full bg-slate-50 border border-slate-250/80 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-404 focus:outline-none focus:border-[#FFC72C] focus:bg-white transition-all font-sans"
              />
            </div>
            <div>
              <select
                id="new-checklist-category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ChecklistItem["category"])}
                className="w-full bg-slate-50 border border-slate-250/80 rounded-lg px-3 py-1.5 text-xs text-slate-850 focus:outline-none focus:border-[#FFC72C] focus:bg-white transition-all cursor-pointer font-sans"
              >
                <option value="Opening">Opening Standard</option>
                <option value="Shift Handover">Shift Handover</option>
                <option value="Closing">Closing Cleanliness</option>
                <option value="Food Safety">Food Safety / HACCP</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                id="save-new-checklist-btn"
                className="w-full bg-[#DA291C] hover:bg-[#C21B10] text-white text-xs font-bold py-1.5 px-3 rounded-lg cursor-pointer transition-colors border border-transparent"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-slate-105 hover:bg-slate-200 text-slate-600 text-xs py-1.5 px-3 rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* FILTERS ROW */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        {/* Category tags */}
        <div className="flex flex-wrap gap-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`text-xs px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                filterCategory === cat
                  ? "bg-[#FFC72C] border border-[#FFC72C] text-[#8B6E00] shadow-2xs font-extrabold text-[11px]"
                  : "bg-white border border-slate-205 text-slate-500 hover:border-slate-350 hover:text-slate-800 hover:bg-slate-50 text-[11px]"
              }`}
              id={`chk-filter-${cat.toLowerCase().replace(" ", "-")}`}
            >
              {cat === "All" ? "All Tasks" : cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-60">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-3.5 w-3.5 text-slate-400" />
          </span>
          <input
            type="text"
            id="checklist-inline-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Find active checklist task..."
            className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs placeholder-slate-400 focus:outline-none focus:border-[#FFC72C]"
          />
        </div>
      </div>

      {/* CHECKLIST LIST VIEW */}
      {filtered.length === 0 ? (
        <div className="p-10 text-center rounded-xl border border-slate-200 bg-white space-y-2">
          <CheckSquare className="w-8 h-8 text-slate-350 mx-auto" />
          <p className="text-sm text-slate-500 font-medium">No tasks found for your selection.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden divide-y divide-slate-100 shadow-2xs">
          {filtered.map((item) => {
            const isSelfEditing = editingId === item.id;

            return (
              <div
                key={item.id}
                className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                  item.completed ? "bg-slate-50/65" : "bg-white hover:bg-slate-50/40"
                }`}
                id={`checklist-row-${item.id}`}
              >
                {isSelfEditing ? (
                  /* INLINE TASK EDITOR FORM */
                  <form onSubmit={handleSaveEdit} className="w-full grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                    <div className="md:col-span-2">
                      <input
                        type="text"
                        required
                        id={`edit-item-task-${item.id}`}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-201 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-[#FFC72C] font-sans"
                      />
                    </div>
                    <div>
                      <select
                        id={`edit-item-cat-${item.id}`}
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value as ChecklistItem["category"])}
                        className="w-full bg-slate-50 border border-slate-201 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-[#FFC72C]"
                      >
                        <option value="Opening">Opening</option>
                        <option value="Shift Handover">Shift Handover</option>
                        <option value="Closing">Closing</option>
                        <option value="Food Safety">Food Safety</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-505 text-white text-[11px] font-bold py-1.5 px-3 rounded cursor-pointer"
                        id={`save-checklist-item-${item.id}`}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-[11px] py-1.5 px-3 rounded cursor-pointer"
                        id={`delete-checklist-item-${item.id}`}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="bg-slate-100 text-slate-600 text-[11px] py-1.5 px-2 rounded cursor-pointer hover:bg-slate-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  /* STANDARD VIEW & CONTROLS */
                  <>
                    <div className="flex items-start gap-4 flex-1">
                      {/* Check Box */}
                      <button
                        onClick={() => handleToggle(item.id)}
                        className={`mt-0.5 w-[18px] h-[18px] rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                          item.completed
                            ? "bg-[#DA291C] border-[#DA291C] text-white font-bold"
                            : "border-slate-300 hover:border-[#DA291C] hover:bg-slate-50"
                        }`}
                        id={`checkbox-toggle-${item.id}`}
                      >
                        {item.completed && <Check className="w-3 h-3 stroke-[3.5]" />}
                      </button>

                      {/* Content block */}
                      <div className="space-y-0.5 min-w-0">
                        <p
                          className={`text-xs font-bold leading-normal ${
                            item.completed ? "text-slate-400 line-through font-normal" : "text-slate-800"
                          }`}
                        >
                          {item.task}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[9px] font-mono text-slate-400">
                          <span className="uppercase text-[#8B6E00] font-extrabold tracking-wider">{item.category}</span>
                          {item.completed && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-emerald-600 font-bold">
                                Done at {item.timeCompleted} by {item.completedBy}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side controls (Edit Button) */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => startEdit(item)}
                        className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Edit duty instructions"
                        id={`edit-checklist-item-btn-${item.id}`}
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Security prompting modal */}
      <SecurityModal
        isOpen={securityModalOpen}
        title={securityModalTitle}
        message={securityModalMessage}
        requirePin={securityModalRequirePin}
        onConfirm={securityModalOnConfirm || (() => {})}
        onCancel={() => setSecurityModalOpen(false)}
      />

    </div>
  );
}
