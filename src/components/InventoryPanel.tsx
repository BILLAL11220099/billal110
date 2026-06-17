/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { InventoryItem, InventoryCategory, UserSession } from "../types";
import {
  Warehouse, Plus, Search, Edit3, Trash2, Save, ArrowLeft,
  Sparkles, Download, Coffee, Trash, RefreshCw, ChevronRight, HelpCircle
} from "lucide-react";
import SecurityModal from "./SecurityModal";
import { initialAppData } from "../data/mockDefaults";
import { motion, AnimatePresence } from "motion/react";

interface InventoryPanelProps {
  inventory: InventoryItem[];
  currentSession: UserSession;
  activeSelectedInventory: InventoryItem | null; // For search-to-edit focus
  onSave: (inventoryList: InventoryItem[]) => void;
}

// Helper to check if item is a cup item
const isCupItem = (name: string): boolean => {
  return name.toLowerCase().includes("cup");
};

// Helper to check if item is liquid (oil, drinks/syrups, etc.)
const isLiquidItem = (name: string, category: InventoryCategory | string): boolean => {
  const normName = name.toLowerCase();
  const normCat = category ? category.toLowerCase() : "";
  return (
    normCat.includes("drinks") ||
    normCat.includes("syrup") ||
    normName.includes("oil") ||
    normName.includes("drink") ||
    normName.includes("syrup") ||
    normName.includes("fanta") ||
    normName.includes("sprite") ||
    normName.includes("spite") || // User typo support
    normName.includes("coke") ||
    normName.includes("cola") ||
    normName.includes("fizz") ||
    normName.includes("juice") ||
    normName.includes("milk") ||
    normName.includes("shake mix") ||
    normName.includes("liquid")
  );
};

// Helper to get the correct unit tag (L for liquid, pcs for solid items)
const getItemUnit = (name: string, category: InventoryCategory | string): string => {
  return isLiquidItem(name, category) ? "L" : "pcs";
};

export default function InventoryPanel({
  inventory,
  currentSession,
  activeSelectedInventory,
  onSave
}: InventoryPanelProps) {
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState("");

  // Download Excel CSV format catalog
  const downloadExcelCSV = () => {
    const headers = [
      "Product Name",
      "Storage Category",
      "Qty per Inner Unit",
      "Inners per Case",
      "Total Qty per Case",
      "Unit Measure (pcs or L)",
      "Lid Info (Cup items)",
      "Last Updated"
    ];

    const rows = inventory.map(item => {
      const isCup = isCupItem(item.name);
      const isLiquid = isLiquidItem(item.name, item.category);
      const parsedPcs = parseFloat(String(item.pcsPerInner));
      const parsedInners = parseFloat(String(item.innersPerCase));
      const totalColVal = (!isNaN(parsedPcs) && !isNaN(parsedInners))
        ? (parsedPcs * parsedInners)
        : `${item.pcsPerInner} x ${item.innersPerCase}`;

      return [
        item.name,
        item.category,
        item.pcsPerInner,
        item.innersPerCase,
        totalColVal,
        isLiquid ? "L" : "pcs",
        isCup ? (item.lidInfo || "N/A") : "—",
        item.lastUpdated
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => 
        row.map(value => {
          const stringified = String(value).replace(/"/g, '""');
          return `"${stringified}"`;
        }).join(",")
      )
    ].join("\n");

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `mcd_packaging_specs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Editor states
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<InventoryCategory>(InventoryCategory.FREEZER);
  
  // Straightforward numeric values represent pieces per sleeve and inners per case, can be text or number
  const [editPcsPerInner, setEditPcsPerInner] = useState<string | number>("40");
  const [editInnersPerCase, setEditInnersPerCase] = useState<string | number>("8");
  const [editLidInfo, setEditLidInfo] = useState<string>("N/A");

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

  // Highlight search item selection
  React.useEffect(() => {
    if (activeSelectedInventory) {
      setIsEditing(false);
      setEditId(null);
      setFilterCategory("All");
      setSearchTerm("");
      setTimeout(() => {
        const element = document.getElementById(`inv-spec-row-${activeSelectedInventory.id}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add("ring-2", "ring-[#DA291C]", "bg-amber-50/70", "scale-[1.01]");
          setTimeout(() => {
            element.classList.remove("ring-2", "ring-[#DA291C]", "bg-amber-50/70", "scale-[1.01]");
          }, 3000);
        }
      }, 150);
    }
  }, [activeSelectedInventory]);

  const handleEdit = (item: InventoryItem) => {
    setEditId(item.id);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditPcsPerInner(item.pcsPerInner !== undefined ? item.pcsPerInner : "1");
    setEditInnersPerCase(item.innersPerCase !== undefined ? item.innersPerCase : "1");
    setEditLidInfo(item.lidInfo || "N/A");
    setIsEditing(true);
  };

  const handleAddNew = () => {
    setEditId(null);
    setEditName("");
    setEditCategory(InventoryCategory.FREEZER);
    setEditPcsPerInner("40");
    setEditInnersPerCase("8");
    setEditLidInfo("N/A");
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    const parseValue = (val: string | number) => {
      const str = String(val).trim();
      return str || "1";
    };

    const pcsPerInner = parseValue(editPcsPerInner);
    const innersPerCase = parseValue(editInnersPerCase);
    const finalizedLidInfo = isCupItem(editName) ? (editLidInfo.trim() || "N/A") : "";

    const onConfirmSave = () => {
      let updatedList: InventoryItem[];
      const now = new Date().toISOString();
      const updatedByText = `${currentSession.username} (${currentSession.role})`;

      if (editId) {
        updatedList = inventory.map(item =>
          item.id === editId
            ? {
                ...item,
                name: editName.trim(),
                category: editCategory,
                pcsPerInner,
                innersPerCase,
                lidInfo: finalizedLidInfo,
                cases: 0,
                inners: 0,
                pcs: 0,
                lastUpdated: now,
                updatedBy: updatedByText
              }
            : item
        );
      } else {
        const newItem: InventoryItem = {
          id: "item_" + Date.now(),
          name: editName.trim(),
          category: editCategory,
          pcsPerInner,
          innersPerCase,
          lidInfo: finalizedLidInfo,
          cases: 0,
          inners: 0,
          pcs: 0,
          lastUpdated: now,
          updatedBy: updatedByText
        };
        updatedList = [newItem, ...inventory];
      }

      onSave(updatedList);
      setIsEditing(false);
      setEditId(null);
    };

    requestConfirmation(
      editId ? "Confirm Specifications Update" : "Confirm New Product Specification",
      `Are you sure you want to save these conversion specifications to the active database? Authorising signature required.`,
      true,
      onConfirmSave
    );
  };

  const handleDelete = (id: string) => {
    requestConfirmation(
      "Confirm Specification Removal",
      "Are you sure you want to delete this packaging specification from the dictionary? Security PIN authorization required.",
      true,
      () => {
        const updatedList = inventory.filter(item => item.id !== id);
        onSave(updatedList);
        setIsEditing(false);
        setEditId(null);
      }
    );
  };

  const filteredItems = inventory.filter(item => {
    const matchesCategory = filterCategory === "All" || item.category === filterCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 font-sans max-w-5xl mx-auto" id="inventory-directory-panel">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-150 pb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-9 h-9 bg-[#DA291C]/10 rounded-xl flex items-center justify-center shrink-0">
              <Warehouse className="w-5 h-5 text-[#DA291C]" />
            </div>
            <h1 className="text-xl font-black text-slate-850 tracking-tight">
              Packaging Specs Dictionary
            </h1>
          </div>
          <p className="text-slate-505 text-xs font-semibold leading-relaxed">
            Quick crew specification lookup. Solid items are measured in <span className="text-amber-700 bg-amber-50 px-1 py-0.5 rounded font-bold">Pieces (pcs)</span> and liquid items (Oil &amp; Drinks/Syrups) are measured in <span className="text-[#DA291C] bg-red-50 px-1 py-0.5 rounded font-bold">Liters (L)</span>.
          </p>
        </div>

        {!isEditing && (
          <div className="flex items-center gap-2">
            <button
              onClick={downloadExcelCSV}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold px-3.5 py-2.5 rounded-xl text-xs transition-all active:scale-95 cursor-pointer border border-slate-200"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </button>
            <button
              onClick={handleAddNew}
              className="flex items-center gap-1.5 bg-[#FFC72C] hover:bg-[#FFD454] text-slate-900 font-black px-4.5 py-2.5 rounded-xl text-xs transition-all active:scale-95 cursor-pointer border-none shadow-sm"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              New Spec
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isEditing ? (
          /* ========================================================
             SIMPLIFIED INSTANT WRITER SPEC FORM
             ======================================================== */
          <motion.div
            key="editing-form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-xs max-w-2xl mx-auto space-y-6"
          >
            {/* Form Top */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                Back to specs list
              </button>
              <span className="text-[10px] uppercase tracking-wider font-extrabold bg-[#DA291C]/10 text-[#DA291C] px-3 py-1 rounded-full border border-[#DA291C]/20">
                {editId ? "Update Product" : "Add Product"}
              </span>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              
              {/* Name */}
              <div>
                <label htmlFor="edit-inventory-name" className="block text-xs font-black text-slate-700 mb-1.5 uppercase tracking-wider">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  id="edit-inventory-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Regular 16oz Cold Cup"
                  className="w-full bg-slate-50 border border-slate-250/90 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-[3px] focus:outline-[#FFC72C]/40 focus:bg-white transition-all font-bold"
                />
              </div>

              {/* Grid: Category & Lid spec directly below if applicable */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-inventory-category" className="block text-xs font-black text-slate-700 mb-1.5 uppercase tracking-wider">
                    Storage Area
                  </label>
                  <select
                    id="edit-inventory-category"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as InventoryCategory)}
                    className="w-full bg-slate-50 border border-slate-250/90 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-[3px] focus:outline-[#FFC72C]/40 focus:bg-white cursor-pointer transition-all font-bold"
                  >
                    <option value={InventoryCategory.FREEZER}>❄️ {InventoryCategory.FREEZER}</option>
                    <option value={InventoryCategory.RAW_COOLER}>🌡️ {InventoryCategory.RAW_COOLER}</option>
                    <option value={InventoryCategory.PAPER_ITEMS}>📦 {InventoryCategory.PAPER_ITEMS}</option>
                    <option value={InventoryCategory.DRINKS_SYRUPS}>🥤 {InventoryCategory.DRINKS_SYRUPS}</option>
                    <option value={InventoryCategory.OTHER}>⚙️ {InventoryCategory.OTHER}</option>
                  </select>
                </div>

                {/* Lid accessories ONLY shown when the name contains cup - Clean, isolated logic! */}
                {isCupItem(editName) ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="bg-amber-50/40 border border-amber-200/60 p-3 rounded-xl space-y-1"
                  >
                    <label htmlFor="edit-inventory-lid" className="block text-[10px] font-black text-amber-900 uppercase tracking-widest flex items-center gap-1">
                      <Coffee className="w-3.5 h-3.5 text-[#DA291C]" />
                      Lid Specifications
                    </label>
                    <input
                      type="text"
                      id="edit-inventory-lid"
                      required
                      value={editLidInfo}
                      onChange={(e) => setEditLidInfo(e.target.value)}
                      placeholder="e.g. Medium Cold Lid (Solo-104)"
                      className="w-full bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800"
                    />
                  </motion.div>
                ) : null}
              </div>

              {/* Pure simplified Unit Specifications Section */}
              <div className="bg-slate-50 rounded-2xl p-4.5 border border-slate-200/80 space-y-4">
                <div className="border-b border-slate-200/60 pb-2">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    Unit Configurations ({getItemUnit(editName, editCategory) === "L" ? "Liquid Model: Liters" : "Solid Model: Pieces"})
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Pieces or Liters per inner sleeve / package */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      {getItemUnit(editName, editCategory) === "L" ? "1 Package Unit (Liters)" : "1 Inner Pack (Sleeve)"}
                    </label>
                    
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => {
                          const parsed = parseFloat(String(editPcsPerInner));
                          setEditPcsPerInner(isNaN(parsed) ? 1 : Math.max(1, parsed - 1));
                        }}
                        className="w-9 h-9 border border-slate-300 rounded-l-lg bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all text-slate-700 font-bold text-sm cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="text"
                        required
                        value={editPcsPerInner}
                        onChange={(e) => setEditPcsPerInner(e.target.value)}
                        placeholder="e.g. 40"
                        className="flex-1 w-20 h-9 border-t border-b border-slate-300 text-center font-mono font-black text-slate-800 text-sm focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const parsed = parseFloat(String(editPcsPerInner));
                          setEditPcsPerInner(isNaN(parsed) ? 1 : parsed + 1);
                        }}
                        className="w-9 h-9 border border-slate-300 rounded-r-lg bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all text-slate-700 font-bold text-sm cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <span className="block text-[10px] text-slate-400 font-semibold text-center italic">
                      {getItemUnit(editName, editCategory) === "L" ? "How many Liters inside 1 container? (Can be text)" : "How many single pieces inside 1 sleeve? (Can be text)"}
                    </span>
                  </div>

                  {/* Sleeves or Containers per Case */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      {getItemUnit(editName, editCategory) === "L" ? "Containers per Case" : "Sleeves per Case"}
                    </label>
                    
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => {
                          const parsed = parseFloat(String(editInnersPerCase));
                          setEditInnersPerCase(isNaN(parsed) ? 1 : Math.max(1, parsed - 1));
                        }}
                        className="w-9 h-9 border border-slate-300 rounded-l-lg bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all text-slate-700 font-bold text-sm cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="text"
                        required
                        value={editInnersPerCase}
                        onChange={(e) => setEditInnersPerCase(e.target.value)}
                        placeholder="e.g. 8"
                        className="flex-1 w-20 h-9 border-t border-b border-slate-300 text-center font-mono font-black text-slate-800 text-sm focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const parsed = parseFloat(String(editInnersPerCase));
                          setEditInnersPerCase(isNaN(parsed) ? 1 : parsed + 1);
                        }}
                        className="w-9 h-9 border border-slate-300 rounded-r-lg bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all text-slate-700 font-bold text-sm cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <span className="block text-[10px] text-slate-400 font-semibold text-center italic">
                      {getItemUnit(editName, editCategory) === "L" ? "How many liquid containers inside 1 case? (Can be text)" : "How many sleeves inside 1 case box? (Can be text)"}
                    </span>
                  </div>
                </div>

                {/* Total pieces automatic math description */}
                <div className="bg-amber-500/5 border border-amber-200 rounded-xl p-3 text-center">
                  {(() => {
                    const parsedPcs = parseFloat(String(editPcsPerInner));
                    const parsedInners = parseFloat(String(editInnersPerCase));
                    const isLiquid = getItemUnit(editName, editCategory) === "L";
                    if (!isNaN(parsedPcs) && !isNaN(parsedInners)) {
                      return (
                        <p className="text-xs text-slate-700 font-semibold">
                          Calculated Wholesale: <strong className="text-slate-900 font-black">1 Case</strong> = {editInnersPerCase} {isLiquid ? "containers" : "sleeves"} × {editPcsPerInner} {getItemUnit(editName, editCategory)} = <strong className="text-[#DA291C] font-black">{parsedInners * parsedPcs} total {getItemUnit(editName, editCategory)}</strong>.
                        </p>
                      );
                    }
                    return (
                      <p className="text-xs text-zinc-600 font-semibold">
                        Custom Configuration: <strong className="text-slate-700 font-black">1 Case</strong> contains "{editInnersPerCase}" and <strong className="text-slate-700 font-black">1 Unit</strong> contains "{editPcsPerInner}".
                      </p>
                    );
                  })()}
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-t border-slate-100 pt-4">
                {editId ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(editId)}
                    className="text-rose-600 bg-rose-50 hover:bg-rose-100/70 text-xs font-black px-4 py-2 rounded-xl flex items-center justify-center gap-1 border border-rose-250 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Spec
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-650 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-slate-900 hover:bg-slate-850 text-white text-xs font-black px-5 py-2 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
                  >
                    <Save className="w-4 h-4 text-[#FFC72C]" />
                    Save Spec
                  </button>
                </div>
              </div>

            </form>
          </motion.div>
        ) : (
          /* ========================================================
             ULTRA CLEAN, EASY GRID DICTIONARY SHEET
             ======================================================== */
          <motion.div
            key="listing-specs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Filter and Inline Search */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-900 p-3 rounded-2xl border border-slate-855 shadow-xs">
              
              {/* Category tabs */}
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setFilterCategory("All")}
                  className={`text-[10px] uppercase font-black tracking-wider px-3.5 py-1.8 rounded-xl transition-all cursor-pointer ${
                    filterCategory === "All"
                      ? "bg-[#FFC72C] text-slate-950"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  All Items
                </button>
                {Object.values(InventoryCategory).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`text-[10px] uppercase font-black tracking-wider px-3.5 py-1.8 rounded-xl transition-all cursor-pointer ${
                      filterCategory === cat
                        ? "bg-[#FFC72C] text-slate-950"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {cat.replace("_", " ")}
                  </button>
                ))}
              </div>

              {/* Simple lookup bar */}
              <div className="relative w-full md:w-60 shrink-0">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Quick lookup spec..."
                  className="w-full bg-slate-800 border border-slate-700/60 text-white rounded-xl pl-9 pr-3 py-2 text-xs placeholder-slate-450 focus:outline-none focus:ring-1 focus:ring-[#FFC72C] font-semibold"
                />
              </div>

            </div>

            {/* Empty views */}
            {inventory.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border-2 border-dashed border-slate-205 bg-white space-y-3 shadow-3xs max-w-sm mx-auto" id="empty-inventory-seeder">
                <Warehouse className="w-10 h-10 text-slate-300 mx-auto" />
                <div>
                  <h3 className="text-xs font-black text-slate-800">Standard Catalog is Empty</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                    Seed McDonald's active conversion specifications list. This will input default metrics instantly.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (confirm("Do you want to restore the 54 packaging conversion specs defaults?")) {
                      onSave(initialAppData.inventory);
                    }
                  }}
                  className="bg-[#FFC72C] text-slate-900 font-extrabold px-4.5 py-2 rounded-xl text-xs flex items-center gap-1 mx-auto"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#DA291C]" />
                  Seed McDonald's Defaults
                </button>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-10 text-center rounded-2xl border border-slate-200 bg-white">
                <p className="text-xs text-slate-450 font-bold">No product specifications match your quick criteria.</p>
                <button
                  onClick={() => {
                    setFilterCategory("All");
                    setSearchTerm("");
                  }}
                  className="text-xs text-[#DA291C] font-black underline mt-2"
                >
                  Clear search filters
                </button>
              </div>
            ) : (
              /* ========================================================
                 ULTRA SCAN-COMPATIBLE ROW-BY-ROW TABLE
                 Focusing ONLY on 1 Inner pieces & 1 Case packaging
                 ======================================================== */
              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-3xs overflow-hidden">
                
                {/* Desktops layout labels */}
                <div className="hidden md:grid grid-cols-12 gap-3 bg-slate-50 px-4 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-150">
                  <div className="col-span-5">Product Brand &amp; Storage Area</div>
                  <div className="col-span-2 text-center">1 Inner Sleeve</div>
                  <div className="col-span-2 text-center">1 Case Pack</div>
                  <div className="col-span-2 text-center">Accessory Lid (Cups Only)</div>
                  <div className="col-span-1 text-right">Edit</div>
                </div>

                <div className="divide-y divide-slate-150/70">
                  {filteredItems.map((item) => {
                    const isCup = isCupItem(item.name);
                    const parsedInners = parseInt(String(item.innersPerCase), 10);
                    const isBulk = parsedInners === 1 || String(item.innersPerCase).toLowerCase().includes("bulk");

                    const parsedPcs = parseFloat(String(item.pcsPerInner));
                    const parsedInnersVal = parseFloat(String(item.innersPerCase));
                    const isValidNumericMatch = !isNaN(parsedPcs) && !isNaN(parsedInnersVal);
                    const totalQtyText = isValidNumericMatch 
                      ? `${parsedPcs * parsedInnersVal} ${getItemUnit(item.name, item.category)}` 
                      : `${item.pcsPerInner} × ${item.innersPerCase}`;

                    return (
                      <div
                        key={item.id}
                        id={`inv-spec-row-${item.id}`}
                        className={`grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 items-center px-4 py-3 hover:bg-slate-50/50 transition-all duration-150 ${
                          isCup ? "bg-amber-50/10" : ""
                        }`}
                      >
                        {/* Name Info segment */}
                        <div className="col-span-1 md:col-span-5 flex flex-col justify-center">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="text-xs font-extrabold text-slate-800 leading-snug">
                              {item.name}
                            </h3>
                            {isCup && (
                              <span className="text-[8px] font-black text-[#8B6E00] bg-[#FFC72C]/20 border border-[#FFD55C]/40 px-1 py-0.2 rounded font-mono uppercase tracking-wider">
                                Cup
                              </span>
                            )}
                          </div>
                          
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono mt-0.5">
                            {item.category.replace("_", " ")}
                          </span>
                        </div>

                        {/* 1 Inner Sleeve pcs info */}
                        <div className="col-span-1 md:col-span-2 flex items-center justify-between md:justify-center border-t border-slate-100 md:border-t-0 pt-2 md:pt-0 shrink-0">
                          <span className="text-[9px] font-black text-slate-400 uppercase md:hidden">
                            {getItemUnit(item.name, item.category) === "L" ? "1 Container (Liters)" : "1 Inner Sleeve"}
                          </span>
                          <div className="text-xs font-mono font-black text-slate-700 bg-slate-100/80 border border-slate-200/90 px-2.5 py-1 rounded-lg text-center shadow-3xs min-w-[75px]">
                            {item.pcsPerInner} {getItemUnit(item.name, item.category)}
                          </div>
                        </div>

                        {/* 1 Case total packaging info */}
                        <div className="col-span-1 md:col-span-2 flex items-center justify-between md:justify-center pt-1.5 md:pt-0">
                          <span className="text-[9px] font-black text-slate-400 uppercase md:hidden">1 Case Total</span>
                          <div className="flex flex-col items-end md:items-center">
                            <span className="text-xs font-mono font-black text-emerald-800 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg text-center shadow-3xs min-w-[85px]">
                              {totalQtyText}
                            </span>
                            <span className="text-[8.5px] text-slate-450 font-bold leading-normal mt-0.5 description-wrap text-center">
                              Pack: {item.innersPerCase}
                            </span>
                          </div>
                        </div>

                        {/* Lid accessories SPECIFICALLY isolated only for cup items */}
                        <div className="col-span-1 md:col-span-2 flex items-center justify-between md:justify-center pt-1.5 md:pt-0">
                          <span className="text-[9px] font-black text-slate-400 uppercase md:hidden">Lid Accessory</span>
                          {isCup ? (
                            item.lidInfo && item.lidInfo !== "N/A" ? (
                              <p className="text-[10.5px] font-bold text-amber-900 bg-amber-50 border border-amber-200/70 py-0.5 px-2 rounded-lg text-center shadow-3xs" title={item.lidInfo}>
                                {item.lidInfo}
                              </p>
                            ) : (
                              <span className="text-[10px] font-semibold text-amber-600 italic">No lid specified</span>
                            )
                          ) : (
                            <span className="text-slate-300 font-bold text-xs">—</span>
                          )}
                        </div>

                        {/* Simple edit button */}
                        <div className="col-span-1 md:col-span-1 flex items-center justify-end border-t border-slate-100 md:border-t-0 pt-2.5 md:pt-0">
                          <button
                            onClick={() => handleEdit(item)}
                            className="bg-slate-50 hover:bg-slate-100 border border-slate-205 text-slate-600 rounded-lg p-1.5 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>

              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
