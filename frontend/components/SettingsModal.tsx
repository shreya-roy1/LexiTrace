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
  const [localModel, setLocalModel] = useState("gpt-4o");
  const [localNli, setLocalNli] = useState(true);
  
  // User centric RAG configurations
  const [chunkSize, setChunkSize] = useState(500);
  const [topK, setTopK] = useState(5);
  const [temperature, setTemperature] = useState(0.2);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedModel = localStorage.getItem("rag_model") || "gpt-4o";
      const savedNli = localStorage.getItem("rag_nli") !== "false";
      const savedChunkSize = parseInt(localStorage.getItem("rag_chunk_size") || "500");
      const savedTopK = parseInt(localStorage.getItem("rag_top_k") || "5");
      const savedTemp = parseFloat(localStorage.getItem("rag_temperature") || "0.2");
      
      setLocalModel(savedModel);
      setLocalNli(savedNli);
      setChunkSize(savedChunkSize);
      setTopK(savedTopK);
      setTemperature(savedTemp);
    }
  }, [isOpen]);

  const syncSettingsToBackend = async (model: string, nli: boolean) => {
    try {
      const activeReranker = localStorage.getItem("rag_reranker") || "bge-reranker-large";
      await fetch("http://localhost:8000/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reranker_model: activeReranker,
          nli_required: nli,
          llm_model: model,
        }),
      });
    } catch (e) {
      console.error("Failed to sync settings to backend:", e);
    }
  };

  const modelVal = parentModel !== undefined ? parentModel : localModel;
  const setModelVal = (val: string) => {
    if (parentSetModel) {
      parentSetModel(val);
    } else {
      setLocalModel(val);
      localStorage.setItem("rag_model", val);
    }
    syncSettingsToBackend(val, nliVal);
  };

  const nliVal = parentNliRequired !== undefined ? parentNliRequired : localNli;
  const setNliVal = (val: boolean) => {
    if (parentSetNliRequired) {
      parentSetNliRequired(val);
    } else {
      setLocalNli(val);
      localStorage.setItem("rag_nli", String(val));
    }
    syncSettingsToBackend(modelVal, val);
  };

  const handleChunkSizeChange = (val: number) => {
    setChunkSize(val);
    localStorage.setItem("rag_chunk_size", String(val));
  };

  const handleTopKChange = (val: number) => {
    setTopK(val);
    localStorage.setItem("rag_top_k", String(val));
  };

  const handleTempChange = (val: number) => {
    setTemperature(val);
    localStorage.setItem("rag_temperature", String(val));
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-[fadeIn_0.2s_ease-out] ${theme}`}>
      <div className="bg-bg-surface/95 border border-border-subtle rounded-2xl w-full max-w-md p-6 shadow-2xl transition-all scale-100 flex flex-col gap-5 select-none text-text-primary backdrop-blur-md">
        
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
        <div className="space-y-5 overflow-y-auto max-h-[400px] pr-1">
          {/* Section: Appearance */}
          <div className="space-y-2">
            <label className="block text-[10px] text-text-secondary font-bold uppercase tracking-wider">Appearance</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { if (theme === "dark") toggleTheme(); }}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  theme === "light"
                    ? "bg-[#0EA5E9] text-white border-transparent shadow-[0_0_15px_rgba(14,165,233,0.25)]"
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
                    ? "bg-[#0EA5E9] text-white border-transparent shadow-[0_0_15px_rgba(14,165,233,0.25)]"
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
                  nliVal ? "bg-emerald-500 justify-end" : "bg-slate-450 justify-start"
                }`}
              >
                <span className="bg-white w-4 h-4 rounded-full shadow-md animate-[pulse_1.5s_infinite]" />
              </button>
            </div>

            {/* Default Chunk Size */}
            <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-bg-sidebar/50 border border-border-subtle/50">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-text-primary">Default Chunk Size</span>
                <span className="text-[10px] text-text-secondary mt-0.5">Tokens per indexed block</span>
              </div>
              <input
                type="number"
                value={chunkSize}
                onChange={(e) => handleChunkSizeChange(parseInt(e.target.value) || 500)}
                className="w-20 bg-bg-surface border border-border-subtle rounded-lg px-2 py-1 text-xs text-text-primary text-right focus:outline-none focus:border-interactive-accent font-medium"
              />
            </div>

            {/* Max Retrieval Top-K */}
            <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-bg-sidebar/50 border border-border-subtle/50">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-text-primary">Max Retrieval Top-K</span>
                <span className="text-[10px] text-text-secondary mt-0.5">Documents loaded to context</span>
              </div>
              <input
                type="number"
                value={topK}
                onChange={(e) => handleTopKChange(parseInt(e.target.value) || 5)}
                className="w-20 bg-bg-surface border border-border-subtle rounded-lg px-2 py-1 text-xs text-text-primary text-right focus:outline-none focus:border-interactive-accent font-medium"
              />
            </div>

            {/* Temperature */}
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-bg-sidebar/50 border border-border-subtle/50">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-text-primary">Generation Temperature</span>
                <span className="text-xs font-mono text-interactive-accent font-bold">{temperature.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.1"
                value={temperature}
                onChange={(e) => handleTempChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-border-subtle rounded-lg appearance-none cursor-pointer accent-interactive-accent"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-border-subtle mt-1">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#0EA5E9] hover:bg-[#0EA5E9]/90 text-white text-xs font-bold transition-all cursor-pointer shadow-[0_0_15px_rgba(14,165,233,0.3)]"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
