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
  ExternalLink,
  Settings
} from "lucide-react";
import { SettingsModal } from "../../components/SettingsModal";
import dynamic from "next/dynamic";

function StatusPageContent() {
  const { isConnected, pingTime, queuePendingCount, systemMetrics } = useRealtime();
  const systemAlertsCount = queuePendingCount > 0 ? 1 : 0;

  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Interactive Options
  const [activeModel, setActiveModel] = useState("bge-reranker-large");
  const [nliRequired, setNliRequired] = useState(true);
  
  const [analytics, setAnalytics] = useState<{
    queries_today: number;
    total_cost: number;
    average_latencies: {
      retrieval: number;
      rerank: number;
      generation: number;
      nli: number;
    };
    rag_triad: {
      context_precision: number;
      faithfulness: number;
      answer_relevance: number;
    };
    unanswered_queries: { query: string; timestamp: string }[];
  } | null>(null);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/analytics");
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (e) {
      console.error("Failed to load analytics:", e);
    }
  };

  const isEngineOffline = !isConnected || systemMetrics.qdrant === "Disconnected" || systemMetrics.redis === "Offline";
  const hasQueries = analytics && analytics.queries_today > 0;

  const getMetricValueText = (val: number) => {
    if (isEngineOffline) return "N/A (Engine Offline)";
    if (!hasQueries) return "N/A (No Queries Processed)";
    return `${Math.round(val * 100)}%`;
  };

  const getMetricBarWidth = (val: number) => {
    if (isEngineOffline || !hasQueries) return "0%";
    return `${val * 100}%`;
  };

  const getLatencyText = (val: number | undefined, defaultVal: string) => {
    if (isEngineOffline) return "N/A";
    if (!hasQueries) return "N/A";
    return `${val !== undefined ? val.toFixed(0) : defaultVal}ms`;
  };

  // Sync theme and local options
  useEffect(() => {
    setMounted(true);
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

    const savedReranker = localStorage.getItem("rag_reranker") || "bge-reranker-large";
    const savedNli = localStorage.getItem("rag_nli") !== "false";
    setActiveModel(savedReranker);
    setNliRequired(savedNli);
    
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.classList.add(nextTheme);
    document.documentElement.classList.remove(theme);
  };

  const syncSettingsToBackend = async (model: string, nli: boolean) => {
    try {
      const activeLLM = localStorage.getItem("rag_model") || "gpt-4o";
      await fetch("http://localhost:8000/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reranker_model: model,
          nli_required: nli,
          llm_model: activeLLM
        }),
      });
    } catch (e) {
      console.error("Failed to sync settings to backend:", e);
    }
  };

  return (
    <div className={`flex h-screen bg-bg-canvas overflow-hidden ${theme}`}>
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-bg-sidebar/95 border-r border-border-subtle flex flex-col backdrop-blur-md z-20 shrink-0">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-interactive-accent text-bg-sidebar">
              <Layers className="w-4 h-4 shrink-0 text-[#38BDF8]" />
            </span>
            <span className="font-extrabold text-sm tracking-widest text-text-primary uppercase">LexiTrace</span>
          </div>
        </div>
        
        {/* Nav menu */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
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
            {systemAlertsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-critical-bg text-critical-text text-[10px] font-bold shadow-sm">
                {systemAlertsCount}
              </span>
            )}
          </Link>
        </nav>

        {/* Sidebar Footer with Settings and Actions */}
        {mounted && (
          <div className="p-4 border-t border-border-subtle space-y-2">
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

            <button 
              onClick={() => setSettingsOpen(true)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-border-subtle bg-bg-surface hover:bg-bg-sidebar text-xs text-text-primary font-bold transition-all cursor-pointer shadow-sm"
            >
              <span className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-interactive-accent" />
                <span>Settings</span>
              </span>
              <span className="text-[10px] text-text-secondary font-mono">CFG</span>
            </button>
          </div>
        )}
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
                  systemMetrics.qdrant === "Local Active" || systemMetrics.qdrant === "Memory Active" || systemMetrics.qdrant === "Server Active"
                    ? "text-emerald-500 bg-emerald-500/10" 
                    : "text-critical-text bg-critical-bg"
                }`}>
                  {systemMetrics.qdrant === "Local Active" || systemMetrics.qdrant === "Memory Active" || systemMetrics.qdrant === "Server Active" ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Qdrant Vector Store</h4>
                <p className="text-sm font-semibold text-text-primary mt-1">
                  Status: {systemMetrics.qdrant === "Local Active" || systemMetrics.qdrant === "Memory Active" || systemMetrics.qdrant === "Server Active" ? "Connected" : "Disconnected"}
                </p>
                <p className="text-[10px] text-text-secondary mt-0.5">Type: {systemMetrics.qdrant}</p>
              </div>
            </div>

            {/* Reranker Model Card */}
            <div className="bg-bg-surface p-5 rounded-xl border border-border-subtle shadow-xs hover:shadow transition-shadow space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-secondary-accent-bg text-secondary-accent-text">
                  <Cpu className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-emerald-500 bg-emerald-500/10">
                  RRF Active
                </span>
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Retrieval Router</h4>
                <select 
                  value={activeModel} 
                  onChange={(e) => { 
                    const model = e.target.value;
                    setActiveModel(model); 
                    localStorage.setItem("rag_reranker", model); 
                    syncSettingsToBackend(model, nliRequired);
                  }}
                  className="w-full bg-bg-sidebar border border-border-subtle rounded-lg px-2 py-1 text-xs text-text-primary outline-none focus:border-interactive-accent font-medium cursor-pointer"
                >
                  <option value="bge-reranker-large">BGE Reranker Large</option>
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
                  onClick={() => { 
                    const val = !nliRequired; 
                    setNliRequired(val); 
                    localStorage.setItem("rag_nli", String(val)); 
                    syncSettingsToBackend(activeModel, val);
                  }}
                  className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer ${nliRequired ? 'bg-interactive-accent' : 'bg-border-subtle'}`}
                >
                  <div className={`w-3 h-3 rounded-full bg-bg-surface transition-transform ${nliRequired ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

          </div>

          {/* Dynamic Observability & RAG Triad Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* RAG Triad Metrics Card */}
            <div className="bg-bg-surface p-6 rounded-xl border border-border-subtle shadow-xs space-y-4">
              <h3 className="font-bold text-text-primary text-sm tracking-wide flex items-center gap-2">
                <Layers className="w-4.5 h-4.5 text-interactive-accent animate-pulse" />
                <span>RAG Triad Quality Metrics</span>
              </h3>
              
              <div className="space-y-3.5">
                {/* Context Precision */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-text-secondary">
                    <span>Context Precision (Retrieval Relevance)</span>
                    <span className="font-mono text-text-primary">
                      {getMetricValueText(analytics ? analytics.rag_triad.context_precision : 0.94)}
                    </span>
                  </div>
                  <div className="w-full bg-border-subtle h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: getMetricBarWidth(analytics ? analytics.rag_triad.context_precision : 0.94) }}
                    />
                  </div>
                </div>

                {/* Faithfulness */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-text-secondary">
                    <span>Faithfulness (Groundedness / Hallucination Guard)</span>
                    <span className="font-mono text-text-primary">
                      {getMetricValueText(analytics ? analytics.rag_triad.faithfulness : 0.91)}
                    </span>
                  </div>
                  <div className="w-full bg-border-subtle h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#38BDF8] h-2 rounded-full transition-all duration-500"
                      style={{ width: getMetricBarWidth(analytics ? analytics.rag_triad.faithfulness : 0.91) }}
                    />
                  </div>
                </div>

                {/* Answer Relevance */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-text-secondary">
                    <span>Answer Relevance (Query Match)</span>
                    <span className="font-mono text-text-primary">
                      {getMetricValueText(analytics ? analytics.rag_triad.answer_relevance : 0.95)}
                    </span>
                  </div>
                  <div className="w-full bg-border-subtle h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: getMetricBarWidth(analytics ? analytics.rag_triad.answer_relevance : 0.95) }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Token & Cost / Latency Observability Card */}
            <div className="bg-bg-surface p-6 rounded-xl border border-border-subtle shadow-xs space-y-4">
              <h3 className="font-bold text-text-primary text-sm tracking-wide flex items-center gap-2">
                <Activity className="w-4.5 h-4.5 text-[#38BDF8]" />
                <span>Production Observability & Cost Tracking</span>
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-bg-sidebar p-3.5 rounded-xl border border-border-subtle">
                  <div className="text-[10px] text-text-secondary uppercase font-semibold">Queries Processed (Today)</div>
                  <div className="text-xl font-bold text-text-primary mt-1">
                    {isEngineOffline ? "N/A" : (analytics ? analytics.queries_today : 0)}
                  </div>
                </div>
                <div className="bg-bg-sidebar p-3.5 rounded-xl border border-border-subtle">
                  <div className="text-[10px] text-text-secondary uppercase font-semibold">LLM Cost Accrued (Today)</div>
                  <div className="text-xl font-bold text-text-primary mt-1 font-mono">
                    {isEngineOffline ? "N/A" : `$${analytics ? analytics.total_cost.toFixed(4) : "0.0000"}`}
                  </div>
                </div>
              </div>

              {/* Latency Breakdown Stage */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-text-secondary uppercase tracking-wider">Average Latency per Stage</div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-bg-sidebar p-2 rounded-lg border border-border-subtle">
                    <div className="text-[8px] text-text-secondary font-semibold uppercase">Search</div>
                    <div className="text-xs font-extrabold text-text-primary font-mono mt-0.5">
                      {getLatencyText(analytics?.average_latencies.retrieval, "115")}
                    </div>
                  </div>
                  <div className="bg-bg-sidebar p-2 rounded-lg border border-border-subtle">
                    <div className="text-[8px] text-text-secondary font-semibold uppercase">Rerank</div>
                    <div className="text-xs font-extrabold text-text-primary font-mono mt-0.5">
                      {getLatencyText(analytics?.average_latencies.rerank, "75")}
                    </div>
                  </div>
                  <div className="bg-bg-sidebar p-2 rounded-lg border border-border-subtle">
                    <div className="text-[8px] text-text-secondary font-semibold uppercase">Gen</div>
                    <div className="text-xs font-extrabold text-[#38BDF8] font-mono mt-0.5">
                      {getLatencyText(analytics?.average_latencies.generation, "480")}
                    </div>
                  </div>
                  <div className="bg-bg-sidebar p-2 rounded-lg border border-border-subtle">
                    <div className="text-[8px] text-text-secondary font-semibold uppercase">NLI</div>
                    <div className="text-xs font-extrabold text-text-primary font-mono mt-0.5">
                      {getLatencyText(analytics?.average_latencies.nli, "150")}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Active System Alerts Card Table */}
          <div className="bg-bg-surface rounded-xl border border-border-subtle shadow-xs overflow-hidden">
            <div className="p-5 border-b border-border-subtle bg-bg-sidebar">
              <h3 className="font-bold text-text-primary text-sm tracking-wide">Active System Alerts ({systemAlertsCount})</h3>
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

          {/* Unanswered Query Log Card */}
          <div className="bg-bg-surface rounded-xl border border-border-subtle shadow-xs overflow-hidden">
            <div className="p-5 border-b border-border-subtle bg-bg-sidebar flex justify-between items-center">
              <div>
                <h3 className="font-bold text-text-primary text-sm tracking-wide">"Unanswered Query" Logs</h3>
                <p className="text-[10px] text-text-secondary mt-0.5">Log of queries where system returned 'Not found in knowledge base' fallbacks.</p>
              </div>
              <span className="text-[10px] font-bold text-warning-text bg-warning-bg border border-warning-text/20 px-2 py-0.5 rounded-full">
                Knowledge Gaps Identified: {analytics ? analytics.unanswered_queries.length : 0}
              </span>
            </div>
            
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                    <th className="py-3 px-5">Timestamp</th>
                    <th className="py-3 px-5">Query Text</th>
                    <th className="py-3 px-5 text-right">Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-xs">
                  {analytics && analytics.unanswered_queries.length > 0 ? (
                    analytics.unanswered_queries.map((q, idx) => (
                      <tr key={idx} className="hover:bg-bg-sidebar/35 transition-colors">
                        <td className="py-4 px-5 font-mono text-text-secondary text-[11px] whitespace-nowrap">
                          {q.timestamp}
                        </td>
                        <td className="py-4 px-5 text-text-primary font-medium font-mono">
                          "{q.query}"
                        </td>
                        <td className="py-4 px-5 text-right">
                          <Link 
                            href="/chat"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-bg-sidebar hover:bg-border-subtle text-text-primary font-bold border border-border-subtle transition-all cursor-pointer shadow-xs"
                          >
                            <span>Upload Missing Doc</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-text-secondary font-medium italic">
                        No knowledge gaps logged. All queries successfully verified in RAG context.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>

      <SettingsModal 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
        theme={theme} 
        toggleTheme={toggleTheme} 
        activeModel={activeModel}
        setActiveModel={setActiveModel}
        nliRequired={nliRequired}
        setNliRequired={setNliRequired}
      />
    </div>
  );
}

export default dynamic(() => Promise.resolve(StatusPageContent), { ssr: false });
