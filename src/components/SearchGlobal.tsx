/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { AppSchema } from "../types";
import { searchEverything, getQuickSuggestions, SearchResultItem } from "../utils/searchEngine";
import { Search, Sparkles, BookOpen, Warehouse, CheckSquare, MessageSquare, Edit3, X } from "lucide-react";

interface SearchGlobalProps {
  appData: AppSchema;
  onSelectItem: (type: "procedure" | "inventory" | "checklist" | "feed", item: any) => void;
}

export default function SearchGlobal({ appData, onSelectItem }: SearchGlobalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute search outcomes as user typing changes
  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setSuggestions([]);
      setResults([]);
      return;
    }

    // Capture suggestions and full matches
    const sug = getQuickSuggestions(appData, trimmed);
    const res = searchEverything(appData, trimmed);

    setSuggestions(sug);
    setResults(res);
  }, [searchTerm, appData]);

  const handleSuggestionClick = (phrase: string) => {
    setSearchTerm(phrase);
    setSuggestions([]);
  };

  const handleClear = () => {
    setSearchTerm("");
    setSuggestions([]);
    setResults([]);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "procedure": return <BookOpen className="w-3.5 h-3.5 text-blue-600" />;
      case "inventory": return <Warehouse className="w-3.5 h-3.5 text-emerald-600" />;
      case "checklist": return <CheckSquare className="w-3.5 h-3.5 text-amber-655" />;
      case "feed": return <MessageSquare className="w-3.5 h-3.5 text-rose-550" />;
      default: return <Sparkles className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "procedure": return "bg-blue-50 text-blue-700 border border-blue-250/60";
      case "inventory": return "bg-emerald-50 text-emerald-700 border border-emerald-250/60";
      case "checklist": return "bg-amber-50 text-amber-800 border border-amber-250/60";
      case "feed": return "bg-rose-50 text-rose-700 border border-rose-200/60";
      default: return "bg-slate-150 text-slate-600 border border-slate-200";
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl z-30 inline-block text-left" id="global-search-container">
      {/* Search Input Bar */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </span>
        <input
          type="text"
          id="global-search-input"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search procedures, inventory loads (patties, 10:1, cheese), feed updates..."
          className="w-full bg-slate-100 border border-slate-200/80 text-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs placeholder-slate-400 focus:outline-none focus:border-[#FFC72C] focus:bg-white focus:ring-1 focus:ring-[#FFC72C] transition-all font-sans"
        />
        {searchTerm && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            id="clear-search-btn"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results Drop-down Panel */}
      {isOpen && (searchTerm.trim().length > 0) && (
        <div 
          className="absolute left-0 mt-2 w-full max-h-[460px] overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-2xl z-50 divide-y divide-slate-100 font-sans"
          id="search-dropdown-panel"
        >
          {/* Section: Autocomplete Suggestions */}
          {suggestions.length > 0 && (
            <div className="p-3 bg-slate-50">
              <span className="text-[9px] font-bold text-slate-500 tracking-wider uppercase block mb-1.5 px-1">
                Suggestions / Autocomplete Match
              </span>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((phrase, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(phrase)}
                    className="bg-white hover:bg-slate-100 text-[#8B6E00] font-semibold text-xs px-2.5 py-1 rounded-md border border-slate-250 transition-colors cursor-pointer"
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Section: Matched Search Rows */}
          <div className="py-1">
            <div className="px-4 py-1.5 flex justify-between items-center text-[9px] font-bold text-slate-400 tracking-wider uppercase">
              <span>Matching Records ({results.length})</span>
              <span>Click to Edit / View</span>
            </div>

            {results.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                No matching results. Try typing shorter words, single letters, or numbers (e.g., <code className="text-[#DA291C] font-semibold">10:1</code>, <code className="text-[#DA291C] font-semibold">pat</code>)
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {results.map((res) => (
                  <button
                    type="button"
                    key={`${res.type}-${res.id}`}
                    onClick={() => {
                       onSelectItem(res.type, res.originalObject);
                      setIsOpen(false);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-slate-50/80 transition-colors flex items-start gap-3 group"
                  >
                    <div className="mt-0.5 p-1.5 rounded bg-slate-50 border border-slate-200 text-slate-400 group-hover:text-[#DA291C] transition-colors">
                      {getTypeIcon(res.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-slate-700 group-hover:text-[#8B6E00] transition-colors truncate">
                          {res.title}
                        </span>
                        <span className={`text-[8px] px-1.5 py-0.2 rounded font-mono ${getTypeBadge(res.type)}`}>
                          {res.type}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-450 line-clamp-1 italic mb-0.5">
                        {res.subtitle}
                      </p>
                      <p className="text-[11px] text-slate-600 font-sans truncate leading-normal" dangerouslySetInnerHTML={{ __html: res.snippet }} />
                    </div>
                    <div className="text-slate-300 group-hover:text-[#DA291C] self-center pl-1">
                      <Edit3 className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
