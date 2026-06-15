/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { motion } from "motion/react";
import { CompanyProcedure, UserSession } from "../types";
import {
  BookOpen, Plus, Search, Edit3, Trash2, Image as ImageIcon,
  CheckCircle, PlusCircle, ArrowLeft, Save, Bold, Italic, List, ListOrdered, Heading, Globe, RefreshCw
} from "lucide-react";
import SecurityModal from "./SecurityModal";

interface ProceduresPanelProps {
  procedures: CompanyProcedure[];
  currentSession: UserSession;
  activeSelectedProcedure: CompanyProcedure | null; // For search-to-edit focus
  onSave: (proceduresList: CompanyProcedure[]) => void;
}

export default function ProceduresPanel({
  procedures,
  currentSession,
  activeSelectedProcedure,
  onSave
}: ProceduresPanelProps) {
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Editor States
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("Kitchen");
  const [editContent, setEditContent] = useState("");
  const [editImage, setEditImage] = useState<string | undefined>(undefined);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Focus Search Selected Procedure
  React.useEffect(() => {
    if (activeSelectedProcedure) {
      handleEdit(activeSelectedProcedure);
    }
  }, [activeSelectedProcedure]);

  const categories = ["All", "Kitchen", "Front Counter", "Drive-Thru", "Food Safety", "Other"];

  // Search in page
  const filtered = procedures.filter(p => {
    const matchesCategory = filterCategory === "All" || p.category === filterCategory;
    const matchesSearch =
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.content.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleEdit = (p: CompanyProcedure) => {
    setEditId(p.id);
    setEditTitle(p.title);
    setEditCategory(p.category);
    setEditContent(p.content);
    setEditImage(p.image);
    setIsEditing(true);
  };

  const handleAddNew = () => {
    setEditId(null);
    setEditTitle("");
    setEditCategory("Kitchen");
    setEditContent("<p><strong>Standard Guidelines:</strong></p><ul><li>Step 1 description.</li><li>Step 2 description.</li></ul>");
    setEditImage(undefined);
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim() || !editContent.trim()) return;

    const onConfirmSave = () => {
      let updatedList: CompanyProcedure[];
      const now = new Date().toISOString();
      const updatedByText = `${currentSession.username} (${currentSession.role})`;

      if (editId) {
        // Edit existing
        updatedList = procedures.map(p =>
          p.id === editId
            ? {
                ...p,
                title: editTitle.trim(),
                category: editCategory,
                content: editContent,
                image: editImage,
                lastUpdated: now,
                updatedBy: updatedByText
              }
            : p
        );
      } else {
        // Add new
        const newProc: CompanyProcedure = {
          id: "proc_" + Date.now(),
          title: editTitle.trim(),
          category: editCategory,
          content: editContent,
          image: editImage,
          lastUpdated: now,
          updatedBy: updatedByText
        };
        updatedList = [newProc, ...procedures];
      }

      onSave(updatedList);
      setIsEditing(false);
      setEditId(null);
    };

    requestConfirmation(
      editId ? "Confirm Guide Edit" : "Create Technical Guide",
      "Are you sure you want to commit these operational guides to the database? Operational PIN verification is required.",
      true, // requirePin = true!
      onConfirmSave
    );
  };

  const handleDelete = (id: string) => {
    requestConfirmation(
      "Remove Technical Guide",
      "Are you sure you want to delete this guide permanently from the procedures directory? Operational PIN verification is required.",
      true, // requirePin = true!
      () => {
        const updatedList = procedures.filter(p => p.id !== id);
        onSave(updatedList);
        setIsEditing(false);
        setEditId(null);
      }
    );
  };

  // Image Upload handler (Base64 file reading)
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Rich Text Helper tag inserter
  const insertTextFormat = (tagOpen: string, tagClose: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;

    const selectedText = currentText.substring(start, end);
    const replacement = tagOpen + selectedText + tagClose;

    const updatedText = currentText.substring(0, start) + replacement + currentText.substring(end);
    setEditContent(updatedText);

    // Reposition cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tagOpen.length, start + tagOpen.length + selectedText.length);
    }, 50);
  };

  const insertParagraph = () => insertTextFormat("<p>", "</p>");
  const insertBold = () => insertTextFormat("<strong>", "</strong>");
  const insertItalic = () => insertTextFormat("<em>", "</em>");
  const insertBulletList = () => insertTextFormat("<ul>\n  <li>", "</li>\n</ul>");
  const insertNumberedList = () => insertTextFormat("<ol>\n  <li>", "</li>\n</ol>");
  const insertListItem = () => insertTextFormat("<li>", "</li>");
  const insertHeader = () => insertTextFormat("<h3>", "</h3>");

  return (
    <div className="space-y-5 font-sans">
      {/* HEADER ROW */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#DA291C]" />
            McDonald's Company Procedures
          </h2>
          <p className="text-slate-400 text-xs mt-0.5 font-medium">
            Store, edit, and instantly search kitchen workstation procedures or store standards.
          </p>
        </div>

        {!isEditing && (
          <button
            onClick={handleAddNew}
            id="add-procedure-btn"
            className="flex items-center gap-1.5 bg-[#FFC72C] hover:bg-[#FFD454] text-[#8B6E00] font-bold px-4 py-1.5 rounded-lg text-xs select-none transition-colors cursor-pointer shadow-xs border border-transparent"
          >
            <Plus className="w-4 h-4" />
            Add New Procedure
          </button>
        )}
      </div>

      {isEditing ? (
        /* ================= PROCEDURE EDITOR ================= */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              id="back-to-procedures-btn"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Discard &amp; Back
            </button>
            <span className="text-[9px] text-slate-400 font-mono tracking-wider uppercase font-semibold">
              {editId ? "Modifying Procedure Record" : "Drafting New Operations Guide"}
            </span>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Left Form Inputs */}
              <div className="md:col-span-2 space-y-3.5">
                {/* Title */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Procedure Title
                  </label>
                  <input
                    type="text"
                    required
                    id="input-procedure-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="e.g. McFlurry Machine Daily Cleaning"
                    className="w-full bg-slate-50 border border-slate-250/80 rounded-lg px-3 py-1.5 text-xs text-slate-850 placeholder-slate-400 focus:outline-none focus:border-[#FFC72C] focus:bg-white transition-all font-sans"
                  />
                </div>

                {/* Category & Writer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Operational Category
                    </label>
                    <select
                      id="select-procedure-category"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-250/80 rounded-lg px-3 py-1.5 text-xs text-slate-850 focus:outline-none focus:border-[#FFC72C] focus:bg-white transition-all cursor-pointer font-sans"
                    >
                      <option value="Kitchen">Kitchen (Grill/Fry/Assembly)</option>
                      <option value="Front Counter">Front Counter / Lobby</option>
                      <option value="Drive-Thru">Drive-Thru</option>
                      <option value="Food Safety">Food Safety / HACCP</option>
                      <option value="Other">Other Store Procedures</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-405 uppercase tracking-wider mb-1">
                      Author Initials (Saved Auto)
                    </label>
                    <div className="bg-slate-105 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-500 select-none">
                      {currentSession.username} ({currentSession.role})
                    </div>
                  </div>
                </div>

                {/* Content Editor Panel with Custom formatting buttons */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Procedure Instructions (Rich Text HTML Editor)
                  </label>
                  
                  {/* Rich Text Toolbar */}
                  <div className="flex flex-wrap items-center bg-slate-150 border border-slate-205 rounded-t-lg p-1.5 gap-1 border-b-0">
                    <button
                      type="button"
                      onClick={insertBold}
                      title="Bold text"
                      className="p-1 hover:bg-slate-250 rounded text-slate-650 hover:text-[#8B6E00] transition-colors cursor-pointer"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={insertItalic}
                      title="Italic text"
                      className="p-1 hover:bg-slate-250 rounded text-slate-655 hover:text-[#8B6E00] transition-colors cursor-pointer"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={insertHeader}
                      title="Heading"
                      className="p-1 hover:bg-slate-250 rounded text-slate-655 hover:text-[#8B6E00] transition-colors cursor-pointer"
                    >
                      <Heading className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={insertParagraph}
                      title="Paragraph wrapper"
                      className="text-[10px] font-bold font-mono px-1.5 py-1 hover:bg-slate-250 rounded text-slate-655 hover:text-[#8B6E00] cursor-pointer"
                    >
                      P
                    </button>
                    <span className="w-px h-4 bg-slate-250 my-auto mx-1" />
                    <button
                      type="button"
                      onClick={insertBulletList}
                      title="Bullet list"
                      className="p-1 hover:bg-slate-255 rounded text-slate-655 hover:text-[#8B6E00] transition-colors cursor-pointer"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={insertNumberedList}
                      title="Numbered list"
                      className="p-1 hover:bg-slate-255 rounded text-slate-655 hover:text-[#8B6E00] transition-colors cursor-pointer"
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={insertListItem}
                      title="Add list item"
                      className="text-[10px] font-bold font-mono px-1.5 py-1 hover:bg-slate-255 rounded text-slate-655 hover:text-[#8B6E00] cursor-pointer"
                    >
                      +Item
                    </button>
                  </div>

                  <textarea
                    ref={textareaRef}
                    required
                    id="input-procedure-content"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={8}
                    placeholder="Describe procedures here. Use HTML tags above or draft freeform text..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-b-lg p-3 text-xs text-slate-800 font-mono focus:outline-none focus:border-[#FFC72C] focus:bg-white transition-all resize-y leading-relaxed"
                  />
                </div>
              </div>

              {/* Right Form Image Upload Box */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Procedure Illustration Photo
                  </label>
                  
                  {/* Image Preview Window */}
                  <div className="border border-slate-200 bg-slate-50 rounded-xl p-3 flex flex-col items-center justify-center min-h-[180px] text-center relative overflow-hidden group">
                    {editImage ? (
                      <>
                        <img
                          src={editImage}
                          alt="Uploaded Illustration"
                          className="max-h-[170px] w-auto object-contain rounded-lg shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-white border border-slate-350 text-slate-800 text-xs px-3 py-1.5 rounded-lg font-semibold hover:bg-slate-50 cursor-pointer"
                          >
                            Change Photo
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2 py-4">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                        <p className="text-[10px] text-slate-500 max-w-[185px] mx-auto leading-relaxed">
                          Directly select or upload a photo for workers on this station
                        </p>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs bg-[#FFC72C]/10 border border-[#FFC72C]/30 text-[#8B6E00] font-semibold px-3 py-1 rounded-lg hover:bg-[#FFC72C]/20 cursor-pointer"
                        >
                          Select Photo
                        </button>
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      id="upload-procedure-image"
                    />
                  </div>

                  {editImage && (
                    <button
                      type="button"
                      onClick={() => setEditImage(undefined)}
                      className="text-xs text-rose-500 hover:text-rose-600 mt-2 block ml-auto font-semibold cursor-pointer"
                      id="remove-procedure-image-btn"
                    >
                      Delete Photo
                    </button>
                  )}
                </div>

                {/* Preview Window Real-time */}
                <div className="border border-slate-200 bg-slate-50 rounded-xl p-3 space-y-1.5">
                  <span className="text-[9px] font-bold text-slate-404 tracking-wider uppercase block">
                    Real-time Layout Preview
                  </span>
                  <div className="h-[120px] overflow-y-auto pr-1 text-xs text-slate-650 leading-relaxed border-t border-slate-200/60 pt-2 font-sans">
                    <h4 className="font-extrabold text-slate-800 text-xs mb-1">{editTitle || "Untitled Draft"}</h4>
                    <div className="markdown-body text-xs text-slate-600" dangerouslySetInnerHTML={{ __html: editContent || "<i>No instructions written yet.</i>" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-3">
              {editId ? (
                <button
                  type="button"
                  onClick={() => handleDelete(editId)}
                  className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs font-semibold px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  id="delete-procedure-action"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Procedure
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                 <button
                  type="submit"
                  id="submit-procedure-btn"
                  className="bg-[#FFC72C] hover:bg-[#FFD454] text-[#8B6E00] text-xs font-extrabold px-5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs border border-transparent"
                >
                  <Save className="w-4 h-4" />
                  Save Instructions
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      ) : (
        /* ================= PROCEDURES GRIDVIEW ================= */
        <div className="space-y-5">
          {/* Filters Row */}
          <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
            {/* Category selection tag badges */}
            <div className="flex flex-wrap gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`text-xs px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
                    filterCategory === cat
                      ? "bg-[#FFC72C] border border-[#FFC72C] text-[#8B6E00] shadow-sm font-extrabold"
                      : "bg-white border border-slate-200 text-slate-500 hover:border-slate-350 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                  id={`cat-filter-${cat.toLowerCase().replace(" ", "-")}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Inner-panel Search Input */}
            <div className="relative w-full md:w-60">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-3.5 w-3.5 text-slate-400" />
              </span>
              <input
                type="text"
                id="procedure-inline-search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter procedures..."
                className="w-full bg-white border border-slate-205 text-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs placeholder-slate-400 focus:outline-none focus:border-[#FFC72C]"
              />
            </div>
          </div>

          {/* Grid of Procedures */}
          {filtered.length === 0 ? (
            <div className="p-12 text-center rounded-xl border border-slate-200 bg-white space-y-2">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm text-slate-500 font-medium font-sans">No procedures matched your filter or search.</p>
              <button
                onClick={() => {
                  setFilterCategory("All");
                  setSearchTerm("");
                }}
                className="text-xs text-[#DA291C] font-semibold hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((item) => (
                <motion.div
                  layoutId={`proc-card-${item.id}`}
                  key={item.id}
                  className="bg-white border border-slate-200/80 rounded-xl hover:border-slate-350 p-4.5 flex flex-col justify-between transition-all group overflow-hidden relative shadow-2xs"
                >
                  <div className="space-y-3.5">
                    {/* Header: Title and category badge */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[9px] uppercase font-bold tracking-wider text-[#DA291C] bg-rose-50 border border-rose-100 px-2 py-0.2 rounded">
                          {item.category}
                        </span>
                        <h3 className="text-slate-805 font-extrabold text-sm tracking-tight leading-snug group-hover:text-[#8B6E00] transition-colors truncate mt-1">
                          {item.title}
                        </h3>
                      </div>

                      <button
                        onClick={() => handleEdit(item)}
                        className="p-1.5 rounded bg-slate-50 border border-slate-200 text-slate-500 hover:text-[#DA291C] hover:bg-slate-105 transition-all select-none cursor-pointer shrink-0"
                        title="Edit procedure"
                        id={`edit-procedure-btn-${item.id}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Layout Split: Illustration + Instructions preview */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-0.5">
                      {item.image && (
                        <div className="sm:col-span-1 rounded-lg border border-slate-150 overflow-hidden bg-slate-50 flex items-center justify-center p-1 h-24 sm:h-auto shrink-0">
                          <img
                            src={item.image}
                            alt={item.title}
                            className="max-h-20 w-full object-contain rounded hover:scale-[1.03] transition-transform"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                      
                      <div className={`${item.image ? "sm:col-span-2" : "sm:col-span-3"} text-[11px] text-slate-600 leading-relaxed max-h-24 overflow-y-auto pr-1`}>
                        <div className="markdown-body text-[11px] text-slate-600" dangerouslySetInnerHTML={{ __html: item.content }} />
                      </div>
                    </div>
                  </div>

                  {/* Metadata line */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-3.5 text-[9px] text-slate-400 font-mono">
                    <span>by {item.updatedBy || "System"}</span>
                    <span>{new Date(item.lastUpdated).toLocaleDateString()}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
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
