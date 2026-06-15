/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { X, Lock, Key, Check } from "lucide-react";
import { motion } from "motion/react";

interface SecurityModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  requirePin?: boolean; // If true, requires the security pin '36810'
  onConfirm: () => void;
  onCancel: () => void;
}

export default function SecurityModal({
  isOpen,
  title,
  message,
  requirePin = false,
  onConfirm,
  onCancel
}: SecurityModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (requirePin) {
      if (pin === "36810") {
        setError("");
        setPin("");
        onConfirm();
      } else {
        setError("Invalid Security PIN code! Access Denied.");
      }
    } else {
      onConfirm();
    }
  };

  const handleClose = () => {
    setPin("");
    setError("");
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between bg-slate-50 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            {requirePin ? (
              <div className="p-1.5 bg-rose-50 border border-rose-100 text-[#DA291C] rounded-lg">
                <Lock className="w-4 h-4" />
              </div>
            ) : (
              <div className="p-1.5 bg-[#FFC72C]/15 border border-[#FFC72C]/30 text-[#8B6E00] rounded-lg">
                <Key className="w-4 h-4" />
              </div>
            )}
            <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">
              {title}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed font-medium">
            {message}
          </p>

          {requirePin && (
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Enter Security PIN code
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="•••••"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    if (error) setError("");
                  }}
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-250/80 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#DA291C] focus:bg-white transition-all font-mono tracking-widest text-center"
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                * Required to approve critical modifications or administrative procedures.
              </p>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-rose-600 text-[11px] font-bold text-center"
                >
                  {error}
                </motion.p>
              )}
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold text-slate-550 border border-slate-205 rounded-xl hover:bg-slate-50 cursor-pointer select-none transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-5 py-2 text-xs font-extrabold max-sm:w-full select-none rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm border border-transparent ${
                requirePin
                  ? "bg-[#DA291C] hover:bg-[#C21B10] text-white"
                  : "bg-[#FFC72C] hover:bg-[#FFD454] text-[#8B6E00]"
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              Confirm Action
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
