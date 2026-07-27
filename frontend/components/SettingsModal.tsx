import React, { useState, useEffect } from "react";
import { X, Sun, Moon, Settings, Cpu, Layers, HardDrive } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  activeModel?: string;
  setActiveModel?: (model: string) => void;
  nliRequired?: boolean;
  setNliRequired?: (req: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  toggleTheme,
  activeModel: parentModel,
  setActiveModel: parentSetModel,
  nliRequired: parentNliRequired,
  setNliRequired: parentSetNliRequired,
}) => {
  // Local state fallbacks synced with localStorage for cross-page persistence
  const [localModel, setLocalModel] = useState("gpt-4o");
  const [localNli, setLocalNli] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedModel = localStorage.getItem("rag_model") || "gpt-4o";
      const savedNli = localStorage.getItem("rag_nli") !== "false";
      setLocalModel(savedModel);
      setLocalNli(savedNli);
    }
  }, [isOpen]);

  const modelVal = parentModel !== undefined ? parentModel : localModel;
  const setModelVal = (val: string) => {
    if (parentSetModel) {
      parentSetModel(val);
    } else {
      setLocalModel(val);
      localStorage.setItem("rag_model", val);
    }
  };

  const nliVal = parentNliRequired !== undefined ? parentNliRequired : localNli;
  const setNliVal = (val: boolean) => {
    if (parentSetNliRequired) {
      parentSetNliRequired(val);
    } else {
      setLocalNli(val);
      localStorage.setItem("rag_nli", String(val));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-bg-surface border border-border-subtle rounded-2xl w-full max-w-md p-6 shadow-2xl transition-all scale-100 flex flex-col gap-5 select-none text-text-primary">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle pb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-interactive-accent animate-[spin_8s_linear_infinite]" />
            <h3 className="font-bold text-base tracking-wide text-text-primary">System Settings</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-bg-sidebar text-text-secondary hover:text-text-primary transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-5">
          {/* Section: Appearance */}
          <div className="space-y-2">
            <label className="block text-[10px] text-text-secondary font-bold uppercase tracking-wider">Appearance</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { if (theme === "dark") toggleTheme(); }}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  theme === "light"
                    ? "bg-interactive-accent text-bg-surface border-interactive-accent shadow-sm"
                    : "bg-bg-sidebar border-border-subtle hover:bg-bg-surface text-text-secondary"
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>Light Mode</span>
              </button>
              <button
                onClick={() => { if (theme === "light") toggleTheme(); }}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-interactive-accent text-bg-surface border-interactive-accent shadow-sm"
                    : "bg-bg-sidebar border-border-subtle hover:bg-bg-surface text-text-secondary"
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>Dark Mode</span>
              </button>
            </div>
          </div>

          {/* Section: RAG Settings */}
          <div className="space-y-3">
            <label className="block text-[10px] text-text-secondary font-bold uppercase tracking-wider">RAG Configurations</label>
            
            {/* LLM Model Selection */}
            <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-bg-sidebar/50 border border-border-subtle/50">
              <span className="text-xs font-semibold text-text-primary">Inference Model</span>
              <select
                value={modelVal}
                onChange={(e) => setModelVal(e.target.value)}
                className="bg-bg-surface border border-border-subtle rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-interactive-accent font-medium cursor-pointer"
              >
                <option value="gpt-4o">GPT-4o (Default)</option>
                <option value="mock-fallback">Mock Fallback</option>
              </select>
            </div>

            {/* NLI Entailment verification toggle */}
            <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-bg-sidebar/50 border border-border-subtle/50">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-text-primary">NLI Verification</span>
                <span className="text-[10px] text-text-secondary mt-0.5">Enforces hallucination checks</span>
              </div>
              <button
                onClick={() => setNliVal(!nliVal)}
                className={`w-10 h-6 flex items-center rounded-full p-1 transition-all duration-300 cursor-pointer ${
                  nliVal ? "bg-emerald-500 justify-end" : "bg-slate-400 justify-start"
                }`}
              >
                <span className="bg-white w-4 h-4 rounded-full shadow-md animate-[pulse_1.5s_infinite]" />
              </button>
            </div>
          </div>

          {/* Section: Development Metadata (No N branding) */}
          <div className="space-y-2">
            <label className="block text-[10px] text-text-secondary font-bold uppercase tracking-wider">Environment Context</label>
            <div className="p-3 rounded-xl border border-border-subtle bg-bg-sidebar/30 space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Bundler
                </span>
                <span className="text-text-primary font-semibold">Webpack</span>
              </div>
              <div className="flex justify-between items-center text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" /> Router
                </span>
                <span className="text-text-primary font-semibold">Next.js App Router</span>
              </div>
              <div className="flex justify-between items-center text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5" /> Build Route
                </span>
                <span className="text-text-primary font-semibold">Static & Dynamic</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-border-subtle mt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-interactive-accent hover:opacity-90 text-bg-surface text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
