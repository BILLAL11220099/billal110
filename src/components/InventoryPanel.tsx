/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { InventoryItem, InventoryCategory, UserSession } from "../types";
import {
  Warehouse, Plus, Search, Edit3, Trash2, Save, ArrowLeft,
  Layers, ChevronRight, Hash, ShieldAlert, Sparkles, Download
} from "lucide-react";
import SecurityModal from "./SecurityModal";
import { initialAppData } from "../data/mockDefaults";

interface InventoryPanelProps {
  inventory: InventoryItem[];
  currentSession: UserSession;
  activeSelectedInventory: InventoryItem | null; // For search-to-edit focus
  onSave: (inventoryList: InventoryItem[]) => void;
}

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
    // CSV Header row
    const headers = [
      "Product / Brand Name",
      "Storage Category",
      "Pieces per Inner Bag",
      "Inners per Case",
      "Total Pieces per Case",
      "Lid / Special Info",
      "Last Updated",
      "Updated By"
    ];

    // CSV rows map
    const rows = inventory.map(item => [
      item.name,
      item.category,
      item.pcsPerInner,
      item.innersPerCase,
      item.pcsPerInner * item.innersPerCase,
      item.lidInfo || "N/A",
      item.lastUpdated,
      item.updatedBy || "System"
    ]);

    // Build the string with full escaping support for Excel compatibility
    const csvContent = [
      headers.join(","),
      ...rows.map(row => 
        row.map(value => {
          const stringified = String(value).replace(/"/g, '""'); // Escape inner quotes
          return `"${stringified}"`; // Wrap in quotes
        }).join(",")
      )
    ].join("\n");

    // Create a client blob download
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" }); // include UTF-8 BOM so Excel opens it with correct encoding!
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `mcd_conversion_specifications_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Editor states
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<InventoryCategory>(InventoryCategory.FREEZER);
  
  // Conversions only
  const [editPcsPerInner, setEditPcsPerInner] = useState<number>(40);
  const [editInnersPerCase, setEditInnersPerCase] = useState<number>(8);
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

  // Focus Search Selected Item
  React.useEffect(() => {
    if (activeSelectedInventory) {
      handleEdit(activeSelectedInventory);
    }
  }, [activeSelectedInventory]);

  const handleEdit = (item: InventoryItem) => {
    setEditId(item.id);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditPcsPerInner(item.pcsPerInner || 1);
    setEditInnersPerCase(item.innersPerCase || 1);
    setEditLidInfo(item.lidInfo || "N/A");
    setIsEditing(true);
  };

  const handleAddNew = () => {
    setEditId(null);
    setEditName("");
    setEditCategory(InventoryCategory.FREEZER);
    setEditPcsPerInner(40);
    setEditInnersPerCase(8);
    setEditLidInfo("N/A");
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    // Sanitize values
    const pcsPerInner = Math.max(1, editPcsPerInner);
    const innersPerCase = Math.max(1, editInnersPerCase);

    const onConfirmSave = () => {
      let updatedList: InventoryItem[];
      const now = new Date().toISOString();
      const updatedByText = `${currentSession.username} (${currentSession.role})`;

      if (editId) {
        // Edit existing
        updatedList = inventory.map(item =>
          item.id === editId
            ? {
                ...item,
                name: editName.trim(),
                category: editCategory,
                pcsPerInner,
                innersPerCase,
                lidInfo: editLidInfo.trim() || "N/A",
                // Keep stock levels as zero for simple conversion info style
                cases: 0,
                inners: 0,
                pcs: 0,
                lastUpdated: now,
                updatedBy: updatedByText
              }
            : item
        );
      } else {
        // Create new
        const newItem: InventoryItem = {
          id: "item_" + Date.now(),
          name: editName.trim(),
          category: editCategory,
          pcsPerInner,
          innersPerCase,
          lidInfo: editLidInfo.trim() || "N/A",
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

    // Ask for PIN code 36810 as security verification for adding/saving item
    requestConfirmation(
      editId ? "Confirm Specification Edit" : "Confirm New Product Creation",
      `Are you sure you want to commit this packaging conversion specification to the store database? You must enter the operational Security PIN to authenticate.`,
      true, // requirePin = true!
      onConfirmSave
    );
  };

  const handleDelete = (id: string) => {
    requestConfirmation(
      "Erase Product Specification",
      "Are you sure you want to delete this packaging specification permanently from the system database? This action requires management security authorization.",
      true, // requirePin = true!
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
    <div className="space-y-4 font-sans max-w-4xl mx-auto" id="inventory-directory-panel">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <Warehouse className="w-4.5 h-4.5 text-[#DA291C]" />
            Item Conversion Spec &amp; Packaging Specs
          </h2>
          <p className="text-slate-400 text-[10px] sm:text-xs">
            Quick crew look-up dictionary. Verified conversion multipliers for inner bags and outer case quantities.
          </p>
        </div>

        {!isEditing && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={downloadExcelCSV}
              id="download-inventory-excel-btn"
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1.5 rounded-lg text-xs select-none transition-colors cursor-pointer border border-transparent shadow-3xs"
            >
              <Download className="w-3.5 h-3.5" />
              Download Excel Spec Catalog
            </button>
            <button
              onClick={handleAddNew}
              id="add-inventory-btn"
              className="flex items-center gap-1.5 bg-[#FFC72C] hover:bg-[#FFD454] text-[#8B6E00] font-extrabold px-3 py-1.5 rounded-lg text-xs select-none transition-colors cursor-pointer border border-transparent shadow-3xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Add New Item Spec
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        /* ================= INVENTORY SPEC EDITOR ================= */
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-4">
            <button
               onClick={() => setIsEditing(false)}
               className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
               id="back-to-inventory-btn"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Cancel &amp; Discard
            </button>
            <span className="text-[9px] text-[#8B6E00] font-bold tracking-wider uppercase bg-[#FFC72C]/10 px-2.5 py-0.5 rounded-full border border-[#FFC72C]/30">
              {editId ? "Update Product Conversions" : "Create New Packaging Specification"}
            </span>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Product Info */}
              <div className="space-y-3.5">
                <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                  1. Core Item Metadata
                </h3>

                <div>
                  <label htmlFor="edit-inventory-name" className="block text-xs font-bold text-slate-500 mb-1">
                    Product / Brand Name
                  </label>
                  <input
                    type="text"
                    required
                    id="edit-inventory-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. Chicken Burger"
                    className="w-full bg-slate-50 border border-slate-250/80 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-[4px] focus:outline-[#FFC72C] focus:bg-white transition-all font-sans"
                  />
                </div>

                <div>
                  <label htmlFor="edit-inventory-category" className="block text-xs font-bold text-slate-500 mb-1">
                    Store Storage Area (Category)
                  </label>
                  <select
                    id="edit-inventory-category"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as InventoryCategory)}
                    className="w-full bg-slate-50 border border-slate-250/80 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-[4px] focus:outline-[#FFC72C] focus:bg-white transition-all cursor-pointer font-sans"
                  >
                    <option value={InventoryCategory.FREEZER}>{InventoryCategory.FREEZER}</option>
                    <option value={InventoryCategory.RAW_COOLER}>{InventoryCategory.RAW_COOLER}</option>
                    <option value={InventoryCategory.PAPER_ITEMS}>{InventoryCategory.PAPER_ITEMS}</option>
                    <option value={InventoryCategory.DRINKS_SYRUPS}>{InventoryCategory.DRINKS_SYRUPS}</option>
                    <option value={InventoryCategory.OTHER}>{InventoryCategory.OTHER}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-inventory-lid" className="block text-xs font-bold text-slate-500 mb-1">
                    Lid / Accessory Info
                  </label>
                  <input
                    type="text"
                    id="edit-inventory-lid"
                    value={editLidInfo}
                    onChange={(e) => setEditLidInfo(e.target.value)}
                    placeholder="e.g. 135 pcs, or N/A"
                    className="w-full bg-slate-50 border border-slate-250/80 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-[4px] focus:outline-[#FFC72C] focus:bg-white transition-all font-sans"
                  />
                </div>
              </div>

              {/* Conversion Rule specs */}
              <div className="space-y-3.5">
                <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">
                  2. Unit Configuration
                </h3>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                  <div className="text-[9px] font-extrabold text-[#DA291C] tracking-wider uppercase flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    Set Conversion Rule Model
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="edit-pcs-per-inner" className="block text-[10px] text-slate-500 mb-1 leading-normal font-bold">
                        1 Inner is how many PCs/Units?
                      </label>
                      <input
                        type="number"
                        id="edit-pcs-per-inner"
                        min="1"
                        required
                        value={editPcsPerInner}
                        onChange={(e) => setEditPcsPerInner(parseInt(e.target.value) || 1)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-slate-800 focus:border-[#FFC72C] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="edit-inners-per-case" className="block text-[10px] text-slate-500 mb-1 leading-normal font-bold">
                        1 Case contains how many Inners?
                      </label>
                      <input
                        type="number"
                        id="edit-inners-per-case"
                        min="1"
                        required
                        value={editInnersPerCase}
                        onChange={(e) => setEditInnersPerCase(parseInt(e.target.value) || 1)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-slate-800 focus:border-[#FFC72C] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-500 font-mono bg-white p-2.5 rounded-lg border border-slate-150 space-y-1">
                    <div className="text-slate-400 flex items-center gap-1">
                      <span className="text-[#DA291C]">💡</span>
                      <span>How this renders inside look-up grid:</span>
                    </div>
                    {editInnersPerCase === 1 ? (
                      <>
                        <div>• 1 Inner Details: <strong className="text-slate-800">N/A</strong> (Bulk bulk bag with no inner dividers)</div>
                        <div>• 1 Case Pack: <strong className="text-slate-800">{editPcsPerInner} pcs</strong> in total</div>
                      </>
                    ) : (
                      <>
                        <div>• 1 Inner Sleeve contains: <strong className="text-slate-800">{editPcsPerInner} pcs</strong></div>
                        <div>• 1 Case contains: <strong className="text-slate-800">{editInnersPerCase} inners</strong> (<strong className="text-slate-800 font-bold text-[#DA291C]">{editInnersPerCase * editPcsPerInner} pcs</strong> in total)</div>
                      </>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-between gap-4 border-t border-slate-150 pt-3">
              {editId ? (
                <button
                  type="button"
                  onClick={() => handleDelete(editId)}
                  className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  id="delete-inventory-action"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Erase Spec
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  id="submit-inventory-btn"
                  className="bg-[#DA291C] hover:bg-[#C21B10] text-[#FFFFFF] text-xs font-extrabold px-4.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-3xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Spec Info
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : (
        /* ================= INVENTORY SPECIFICATIONS GRID ================= */
        <div className="space-y-3">
          
          {/* Filters & search block */}
          <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
            
            {/* Storage Area Tabs */}
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setFilterCategory("All")}
                className={`text-[10px] sm:text-xs px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                  filterCategory === "All"
                    ? "bg-[#FFC72C] text-[#8B6E00] shadow-3xs font-extrabold"
                    : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
                id="inv-filter-all"
              >
                All Areas
              </button>
              {Object.values(InventoryCategory).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`text-[10px] sm:text-xs px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                    filterCategory === cat
                      ? "bg-[#FFC72C] text-[#8B6E00] shadow-3xs font-extrabold"
                      : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                  id={`inv-filter-${cat.toLowerCase().replace(" ", "-").replace("&", "-")}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Filter Search Input */}
            <div className="relative w-full md:w-64">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <Search className="h-3.5 w-3.5 text-slate-400" />
              </span>
              <input
                type="text"
                id="inventory-inline-search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Find spec info (e.g., burger, beef)..."
                className="w-full bg-white border border-slate-200 text-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs placeholder-slate-400 focus:outline-[3px] focus:outline-[#FFC72C] transition-all font-sans font-medium"
              />
            </div>
          </div>

          {/* Specs Sheet Presentation */}
          {inventory.length === 0 ? (
            <div className="p-10 text-center rounded-2xl border border-dashed border-slate-300 bg-white space-y-4 shadow-3xs max-w-lg mx-auto" id="empty-inventory-seeder">
              <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center mx-auto text-[#DA291C]">
                <Warehouse className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">No Product Specifications Found</h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                  Your store database does not currently have any packaging conversion or product items registered. Would you like to seed the standard McDonald's product catalog containing 54 brand specifications?
                </p>
              </div>
              <button
                onClick={() => {
                  if (confirm("Confirm DB Seed: This will write 54 standard McDonald's product conversion specifications to your active database. Continue?")) {
                    onSave(initialAppData.inventory);
                  }
                }}
                className="inline-flex items-center gap-1.5 bg-[#FFC72C] hover:bg-[#FFD454] text-[#8B6E00] font-extrabold px-6 py-2.5 rounded-xl text-xs select-none transition-colors cursor-pointer border border-[#FFC72C]/30 shadow-xs"
              >
                <Sparkles className="w-4 h-4 text-[#DA291C]" />
                Seed Standard McDonald's Catalog (54 Items)
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center rounded-xl border border-slate-200 bg-white space-y-1.5 shadow-3xs">
              <Warehouse className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">No conversion specs match your selector criteria.</p>
              <button
                onClick={() => {
                  setFilterCategory("All");
                  setSearchTerm("");
                }}
                className="text-[11px] text-[#DA291C] font-extrabold hover:underline cursor-pointer"
              >
                Reset Filter Settings
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-3xs">
              
              {/* TABLE HEADER (Desktop layout) */}
              <div className="hidden md:grid grid-cols-12 gap-4 bg-slate-50 px-4 py-2.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-150">
                <div className="col-span-4">Product Name &amp; Category</div>
                <div className="col-span-2 text-center">1 Inner Details</div>
                <div className="col-span-3 text-center">Case Details</div>
                <div className="col-span-2 text-center">Lid / Accessory Info</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              {/* ROWS */}
              <div className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const pcs = item.pcsPerInner || 1;
                  const inners = item.innersPerCase || 1;
                  const isBulk = inners === 1;

                  return (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 md:grid-cols-12 gap-2.5 md:gap-4 items-center px-4 py-3 sm:py-3.5 hover:bg-slate-50/70 transition-colors"
                      id={`inv-spec-row-${item.id}`}
                    >
                      {/* Name / Category Column */}
                      <div className="col-span-1 md:col-span-4 flex flex-col sm:flex-row sm:items-center justify-between md:justify-start gap-1.5">
                        <div>
                          <h3 className="text-xs font-bold text-slate-800 font-sans tracking-tight leading-snug">
                            {item.name}
                          </h3>
                          <span className="text-[8px] font-bold uppercase bg-slate-50 border border-slate-200 text-slate-500 px-1.5 py-0.2 rounded font-mono mt-0.5 inline-block">
                            {item.category}
                          </span>
                        </div>
                      </div>

                      {/* Inner Sleeve Details */}
                      <div className="col-span-1 md:col-span-2 flex items-center justify-between md:justify-center border-t border-slate-100 md:border-t-0 pt-2 md:pt-0">
                        <span className="text-[9px] font-bold text-slate-400 uppercase md:hidden">1 Inner :</span>
                        {isBulk ? (
                          <span className="text-xs font-mono text-slate-400 uppercase font-semibold">N/A</span>
                        ) : (
                          <div className="text-xs font-mono font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 sm:px-2.5 py-1 rounded-lg text-center min-w-[80px]">
                            {pcs} Pcs
                          </div>
                        )}
                      </div>

                      {/* Outer Case Packing Details */}
                      <div className="col-span-1 md:col-span-3 flex items-center justify-between md:justify-center pt-1 md:pt-0">
                        <span className="text-[9px] font-bold text-slate-400 uppercase md:hidden">Case Details :</span>
                        {isBulk ? (
                          <div className="text-xs font-mono font-bold text-[#DA291C] bg-[#DA291C]/5 border border-[#DA291C]/15 px-2.5 py-1 rounded-lg text-center min-w-[120px]">
                            1 case = {pcs} pcs
                          </div>
                        ) : (
                          <div className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-center min-w-[120px] flex flex-col items-center">
                            <span>1 case ({inners} inner)</span>
                            <span className="text-[8px] text-emerald-600 block leading-tight font-sans mt-0.5 uppercase tracking-tight">
                              Total: {inners * pcs} pcs
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Lid / Accessory Info Details */}
                      <div className="col-span-1 md:col-span-2 flex items-center justify-between md:justify-center pt-1 md:pt-0">
                        <span className="text-[9px] font-bold text-slate-400 uppercase md:hidden">Lid Info :</span>
                        <div className="text-xs font-mono font-bold text-amber-800 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg text-center min-w-[100px] truncate" title={item.lidInfo || "N/A"}>
                          {item.lidInfo || "N/A"}
                        </div>
                      </div>

                      {/* Edit actions button */}
                      <div className="col-span-1 md:col-span-1 flex items-center justify-end border-t border-slate-100 md:border-t-0 pt-2.5 md:pt-0">
                        <button
                          onClick={() => handleEdit(item)}
                          className="w-full md:w-auto flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-[#FFC72C]/10 border border-slate-200 hover:border-[#FFC72C]/30 text-slate-500 hover:text-[#8B6E00] text-[10px] font-bold px-2 py-1 rounded-lg transition-all cursor-pointer shadow-3xs"
                          id={`edit-item-btn-${item.id}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span className="md:hidden">Edit Spec</span>
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* Quick Informational Notice Footer */}
          <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl flex items-start gap-2.5 font-sans mt-1">
            <ShieldAlert className="w-4 h-4 text-slate-450 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-500 leading-relaxed font-semibold">
              <span className="text-slate-700 font-bold">Standard Conversion Note:</span> To locate precise unit measurements, you can filter by Storage Area (Freezer, Cooler, Drinks, etc). Need to customize the standard package numbers? Click the "Edit" button adjacent to any item to redefine its conversion metrics of Inner sizes and Case packaging structures.
            </div>
          </div>

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
