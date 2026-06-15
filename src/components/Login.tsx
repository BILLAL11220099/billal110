/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { UserSession } from "../types";
import { LogIn, Users, ChefHat, Award, ShieldAlert } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (session: UserSession) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("MD Billal Ahmed");
  const [role, setRole] = useState<UserSession["role"]>("Crew");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const rolesList: { value: UserSession["role"]; label: string; description: string; icon: any }[] = [
    {
      value: "Crew",
      label: "Crew Member",
      description: "Log inventory, review procedures, and tick active checklists.",
      icon: Users
    },
    {
      value: "Trainer",
      label: "Certified Trainer",
      description: "Manage training guides, edit checklists, and log procedures.",
      icon: Award
    },
    {
      value: "Kitchen Leader",
      label: "Kitchen Leader",
      description: "Oversee kitchen standards, audit inventory levels, and post shift news.",
      icon: ChefHat
    },
    {
      value: "Business Manager",
      label: "Business Manager",
      description: "Full access. Clean histories, approve backups, and post announcements.",
      icon: ShieldAlert
    }
  ];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    if (pin.trim() !== "36810") {
      setError("Incorrect Security Access Code (use 36810)");
      return;
    }
    setError("");
    onLoginSuccess({
      username: username.trim(),
      role: role
    });
  };

  return (
    <div className="min-h-screen bg-[#F4F4F5] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background radial accent resembling golden glow of arches */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#FFC72C]/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden p-6 sm:p-7 z-10"
      >
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#FFC72C] mb-3 border border-[#FFC72C]/30 shadow-sm">
            {/* Elegant McDonald's M design using gold block */}
            <span className="text-3xl font-black text-[#DA291C] font-sans select-none leading-none">M</span>
          </div>
          <h1 className="text-lg font-extrabold text-slate-800 tracking-tight leading-tight">M-OPS Hub</h1>
          <p className="text-slate-450 text-[11px] mt-1 uppercase tracking-wider font-semibold font-sans">Crew operations portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Custom Name */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Crew Member Name
            </label>
            <input
              type="text"
              required
              id="crew-username-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. MD Billal Ahmed"
              className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#FFC72C] focus:bg-white transition-all"
            />
          </div>

          {/* Quick Role Selection Card List */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Select Shift Role
            </label>
            <div className="grid grid-cols-1 gap-2">
              {rolesList.map((item) => {
                const Icon = item.icon;
                const isSelected = role === item.value;
                return (
                  <button
                    type="button"
                    key={item.value}
                    id={`role-btn-${item.value.toLowerCase().replace(" ", "-")}`}
                    onClick={() => setRole(item.value)}
                    className={`flex items-start p-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? "bg-[#FFC72C]/10 border-[#FFC72C] text-[#8B6E00] shadow-2xs font-semibold"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/70 hover:text-slate-800"
                    }`}
                  >
                    <div className={`p-1 rounded-md mr-2.5 shrink-0 ${isSelected ? "text-[#8B6E00] bg-[#FFC72C]/25" : "text-slate-400 bg-slate-150"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold leading-normal">{item.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 leading-tight truncate">{item.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Security PIN code input field */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Security Number (PIN)
            </label>
            <input
              type="password"
              required
              id="crew-pin-input"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                if (error) setError("");
              }}
              placeholder="Enter 36810"
              className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#DA291C] focus:bg-white transition-all font-mono tracking-widest text-center"
            />
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-rose-600 text-[10px] font-bold mt-1.5 text-center"
              >
                {error}
              </motion.p>
            )}
          </div>

          {/* Default Login Button only */}
          <button
            type="submit"
            id="default-login-btn"
            className="w-full bg-[#FFC72C] hover:bg-[#FFD454] active:bg-[#E2AF24] text-[#8B6E00] font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 shadow-sm"
          >
            <LogIn className="w-4 h-4 text-[#DA291C]" />
            Access Systems Logon
          </button>
        </form>
      </motion.div>

      {/* Footer credits in minimal style */}
      <p className="text-[9px] text-slate-400 mt-6 font-mono uppercase tracking-widest">
        SYSTEM SHIFT PORTAL • PORT 3000 • DEBUT 2026
      </p>
    </div>
  );
}
