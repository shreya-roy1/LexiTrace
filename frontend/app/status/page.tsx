"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRealtime } from "../../context/RealtimeContext";
import { 
  MessageSquare, 
  BookOpen, 
  LayoutDashboard,
  Sun,
  Moon,
  Activity,
  CheckCircle,
  AlertTriangle,
  Server,
  Database,
  Cpu,
  Layers,
  ArrowRight,
  ExternalLink
} from "lucide-react";

export default function StatusPage() {
  const { isConnected, pingTime, queuePendingCount, systemMetrics } = useRealtime();

  const [theme, setTheme] = useState<"light" | "dark">("dark");
  
  // Interactive Options
  const [activeModel, setActiveModel] = useState("bge-reranker-large");
  const [nliRequired, setNliRequired] = useState(true);

  // Sync theme
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
      document.documentElement.classList.add(storedTheme);
      document.documentElement.classList.remove(storedTheme === "dark" ? "light" : "dark");
    } else {
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initialTheme = systemDark ? "dark" : "light";
      setTheme(initialTheme);
      document.documentElement.classList.add(initialTheme);
      document.documentElement.classList.remove(initialTheme === "dark" ? "light" : "dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.classList.add(nextTheme);
    document.documentElement.classList.remove(theme);
  };

  return (
    <div className="flex h-screen bg-bg-canvas text-text-primary overflow-hidden font-sans">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-bg-sidebar border-r border-border-subtle flex flex-col justify-between shrink-0 hidden md:flex">
        <div className="flex flex-col">
          {/* Logo - Minimal Typography Design */}
          <div className="p-6 border-b border-border-subtle">
            <h1 className="font-extrabold text-xl tracking-wider text-text-primary">LexiTrace</h1>
            <span className="text-[9px] text-text-secondary font-bold uppercase tracking-widest block mt-0.5">Enterprise RAG</span>
          </div>
          
          {/* Nav menu */}
          <nav className="p-4 space-y-1">
            <Link 
              href="/chat" 
              className="flex items-center gap-3 px-4 py-3 border-l-2 border-transparent text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-all rounded-r-md font-medium"
            >
              <MessageSquare className="w-5 h-5" />
              <span>Conversational Chat</span>
            </Link>
            <Link 
              href="/review" 
              className="flex items-center justify-between px-4 py-3 border-l-2 border-transparent text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-all rounded-r-md font-medium"
            >
              <span className="flex items-center gap-3">
                <LayoutDashboard className="w-5 h-5" />
                <span>HITL Review Queue</span>
              </span>
              {queuePendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-critical-bg text-critical-text text-[10px] font-bold shadow-xs">
                  {queuePendingCount}
                </span>
              )}
            </Link>
            <Link 
              href="/status" 
              className="flex items-center justify-between px-4 py-3 border-l-2 border-interactive-accent bg-bg-surface text-text-primary font-bold transition-all rounded-r-md"
            >
              <span className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-interactive-accent" />
                <span>System Status</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-critical-bg text-critical-text text-[10px] font-bold shadow-sm">2</span>
            </Link>
          </nav>
        </div>

        {/* Sidebar Footer with Theme Toggle */}
        <div className="p-4 border-t border-border-subtle space-y-4">
          <button 
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-border-subtle bg-bg-surface hover:bg-bg-sidebar text-xs text-text-primary font-bold transition-all cursor-pointer shadow-sm"
          >
            <span className="flex items-center gap-2">
              {theme === "dark" ? <Sun className="w-4 h-4 text-warning-text" /> : <Moon className="w-4 h-4 text-interactive-accent" />}
              <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
            </span>
            <span className="text-[10px] text-text-secondary font-mono">{theme.toUpperCase()}</span>
          </button>
        </div>
      </aside>

      {/* Main workplace */}
      <main className="flex-1 flex flex-col min-w-0 bg-bg-canvas overflow-y-auto custom-scrollbar">
        
        {/* Reconnect warning banner */}
        {!isConnected && (
          <div className="bg-critical-bg border-b border-critical-text/10 py-2 px-6 text-center text-xs font-semibold text-critical-text flex items-center justify-center gap-2 animate-pulse z-20 shrink-0">
            <AlertTriangle className="w-4 h-4" />
            <span>Reconnecting to live LexiTrace engine...</span>
          </div>
        )}

        {/* Top Header */}
        <header className="h-16 bg-bg-sidebar/90 border-b border-border-subtle flex items-center justify-between px-6 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3 md:hidden">
            <span className="font-extrabold tracking-wider text-text-primary">LexiTrace</span>
          </div>
          <h2 className="hidden md:block font-bold text-text-primary text-base tracking-wide">System Health & Pipeline Configuration</h2>
          <div className="flex gap-2">
            <Link 
              href="/chat" 
              className="md:hidden px-3 py-1.5 rounded bg-bg-sidebar text-text-secondary text-xs font-semibold border border-border-subtle"
            >
              Chat
            </Link>
            <Link 
              href="/review" 
              className="md:hidden px-3 py-1.5 rounded bg-bg-sidebar text-text-secondary text-xs font-semibold border border-border-subtle"
            >
              HITL
            </Link>
            <Link 
              href="/status" 
              className="md:hidden px-3 py-1.5 rounded bg-secondary-accent-bg text-secondary-accent-text text-xs font-semibold border border-interactive-accent/25"
            >
              Status
            </Link>
            <button 
              onClick={toggleTheme}
              className="md:hidden p-1.5 rounded border border-border-subtle bg-bg-sidebar hover:bg-bg-canvas transition-all"
            >
              {theme === "dark" ? <Sun className="w-4 h-4 text-warning-text" /> : <Moon className="w-4 h-4 text-interactive-accent" />}
            </button>
          </div>
        </header>

        {/* Dashboard Grid Content */}
        <div className="p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-text-primary">Pipeline Dashboard</h3>
              <p className="text-xs text-text-secondary mt-1">Real-time status diagnostics, model routing configurations, and compliance alerts.</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-sidebar border border-border-subtle text-xs font-semibold shadow-xs">
              <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-critical-text"}`}></span>
              <span>{isConnected ? `Connected (WS latency: ${pingTime}ms)` : "Engine offline"}</span>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* FastAPI Card */}
            <div className="bg-bg-surface p-5 rounded-xl border border-border-subtle shadow-xs hover:shadow transition-shadow space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-secondary-accent-bg text-secondary-accent-text">
                  <Server className="w-5 h-5" />
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  systemMetrics.fastapi === "Connected" 
                    ? "text-emerald-500 bg-emerald-500/10" 
                    : "text-critical-text bg-critical-bg"
                }`}>
                  {systemMetrics.fastapi}
                </span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">FastAPI Engine</h4>
                <p className="text-sm font-semibold text-text-primary mt-1">
                  Status: {systemMetrics.fastapi === "Connected" ? "Operational" : "Offline"}
                </p>
                <p className="text-[10px] text-text-secondary mt-0.5">Port: 8000 (Localhost)</p>
              </div>
            </div>

            {/* Qdrant DB Card */}
            <div className="bg-bg-surface p-5 rounded-xl border border-border-subtle shadow-xs hover:shadow transition-shadow space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-secondary-accent-bg text-secondary-accent-text">
                  <Database className="w-5 h-5" />
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  systemMetrics.qdrant === "Local Active" 
                    ? "text-primary-accent bg-secondary-accent-bg" 
                    : "text-critical-text bg-critical-bg"
                }`}>
                  {systemMetrics.qdrant}
                </span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Qdrant Vector Store</h4>
                <p className="text-sm font-semibold text-text-primary mt-1">
                  Status: {systemMetrics.qdrant === "Local Active" ? "Connected" : "Disconnected"}
                </p>
                <p className="text-[10px] text-text-secondary mt-0.5">Collection: enterprise_docs</p>
              </div>
            </div>

            {/* Reranker Model Card */}
            <div className="bg-bg-surface p-5 rounded-xl border border-border-subtle shadow-xs hover:shadow transition-shadow space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-secondary-accent-bg text-secondary-accent-text">
                  <Cpu className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-bold text-text-primary bg-citation-std-bg px-2 py-0.5 rounded-full">
                  BAAI/bge
                </span>
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Reranker Model</h4>
                <select 
                  value={activeModel} 
                  onChange={(e) => setActiveModel(e.target.value)}
                  className="w-full bg-bg-sidebar border border-border-subtle rounded-lg px-2 py-1 text-xs text-text-primary outline-none focus:border-interactive-accent"
                >
                  <option value="bge-reranker-large">BGE-Reranker-Large</option>
                  <option value="cohere-rerank-v3">Cohere Rerank v3</option>
                  <option value="none">No Reranking</option>
                </select>
              </div>
            </div>

            {/* NLI Rules Card */}
            <div className="bg-bg-surface p-5 rounded-xl border border-border-subtle shadow-xs hover:shadow transition-shadow space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-secondary-accent-bg text-secondary-accent-text">
                  <Layers className="w-5 h-5" />
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  systemMetrics.redis === "Active" 
                    ? "text-emerald-500 bg-emerald-500/10" 
                    : "text-text-secondary bg-citation-std-bg"
                }`}>
                  Celery: {systemMetrics.redis === "Active" ? `${systemMetrics.queue_depth} Queued` : "Offline"}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div>
                  <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Citation Entailment</h4>
                  <p className="text-[10px] text-text-secondary mt-0.5">Require entailment check</p>
                </div>
                <button 
                  onClick={() => setNliRequired(!nliRequired)}
                  className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer ${nliRequired ? 'bg-interactive-accent' : 'bg-border-subtle'}`}
                >
                  <div className={`w-3 h-3 rounded-full bg-bg-surface transition-transform ${nliRequired ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

          </div>

          {/* Active System Alerts Card Table */}
          <div className="bg-bg-surface rounded-xl border border-border-subtle shadow-xs overflow-hidden">
            <div className="p-5 border-b border-border-subtle bg-bg-sidebar">
              <h3 className="font-bold text-text-primary text-sm tracking-wide">Active System Alerts ({queuePendingCount > 0 ? "2" : "1"})</h3>
              <p className="text-[10px] text-text-secondary mt-0.5">Warnings and notices identified during indexing and document alignment check.</p>
            </div>
            
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                    <th className="py-3 px-5">Severity</th>
                    <th className="py-3 px-5">Component</th>
                    <th className="py-3 px-5">Description</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-xs">
                  
                  {/* Issue 1: Low confidence OCR */}
                  {queuePendingCount > 0 && (
                    <tr className="hover:bg-bg-sidebar/35 transition-colors">
                      <td className="py-4 px-5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-warning-bg text-warning-text">
                          <AlertTriangle className="w-3 h-3" /> Warning
                        </span>
                      </td>
                      <td className="py-4 px-5 font-mono text-text-secondary text-[11px]">Layout Parser (OCR)</td>
                      <td className="py-4 px-5 text-text-primary font-medium">
                        OCR parsing confidence falls under 85% threshold on document <span className="font-bold font-mono">Doc 2</span> (file: <span className="font-mono text-text-secondary text-[11px]">cost_breakdown_2024.pdf</span>).
                      </td>
                      <td className="py-4 px-5 text-right">
                        <Link 
                          href="/review"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-bg-sidebar hover:bg-border-subtle text-text-primary font-bold border border-border-subtle transition-all cursor-pointer shadow-xs"
                        >
                          <span>Review in HITL</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  )}

                  {/* Issue 2: NLI check notification */}
                  <tr className="hover:bg-bg-sidebar/35 transition-colors">
                    <td className="py-4 px-5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-secondary-accent-bg text-secondary-accent-text">
                        <CheckCircle className="w-3 h-3" /> Notice
                      </span>
                    </td>
                    <td className="py-4 px-5 font-mono text-text-secondary text-[11px]">Verification Layer</td>
                    <td className="py-4 px-5 text-text-primary font-medium">
                      NLI Entailment verification pipeline successfully enabled for active ground-truth hallucination checks.
                    </td>
                    <td className="py-4 px-5 text-right">
                      <a 
                        href="http://localhost:8000/docs"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-text-secondary hover:text-text-primary font-semibold transition-all shadow-xs"
                      >
                        <span>API Docs</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>

    </div>
  );
}
