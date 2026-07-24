"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRealtime } from "../../context/RealtimeContext";

import { 
  ClipboardCheck, 
  FileText, 
  Check, 
  ChevronRight, 
  MessageSquare, 
  AlertTriangle,
  RefreshCw,
  Edit3,
  CheckCircle,
  LayoutDashboard,
  Sun,
  Moon,
  Activity
} from "lucide-react";

interface IngestDocument {
  id: string;
  text: string;
  source_pdf: string;
  page_number: number;
  confidence_score: number;
}

export default function ReviewPage() {
  const { isConnected, queuePendingCount } = useRealtime();

  const [queue, setQueue] = useState<IngestDocument[]>([]);
  const [activeItem, setActiveItem] = useState<IngestDocument | null>(null);
  const [editedText, setEditedText] = useState("");
  const [editedPage, setEditedPage] = useState<number>(0);
  const [editedSource, setEditedSource] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Theme state
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:8000/api/review");
      if (!response.ok) throw new Error("Server error");
      const data = await response.json();
      setQueue(data);
      if (data.length > 0) {
        const isCurrentActiveStillInQueue = data.some((item: IngestDocument) => activeItem && item.id === activeItem.id);
        if (!isCurrentActiveStillInQueue) {
          selectItem(data[0]);
        }
      } else {
        setActiveItem(null);
      }
    } catch (error) {
      console.error("Failed to load review queue from backend:", error);
      
      const mockQueue: IngestDocument[] = [
        {
          id: "lc-doc-1",
          text: "Table 3: Q3 financial metrics.\nRevenue: $12.4M (up 8% YoY)\nNet Income: $1.8M\nOperating Margin: 14.5% (approximate count)",
          source_pdf: "q3_financial_report.pdf",
          page_number: 3,
          confidence_score: 0.78
        },
        {
          id: "lc-doc-2",
          text: "Product Development Costs\nSalaries: $4.2M\nInfrastructure: $1.1M\nLicensing: $0.3M\nTotal: $5.6M (estimates)",
          source_pdf: "cost_breakdown_2024.pdf",
          page_number: 5,
          confidence_score: 0.65
        }
      ];
      setQueue(mockQueue);
      if (!activeItem) {
        selectItem(mockQueue[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    // Theme sync
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

  // Listen to WebSocket queue updates dynamically
  useEffect(() => {
    const handleQueueUpdate = () => {
      fetchQueue();
    };
    window.addEventListener("lexitrace_queue_updated", handleQueueUpdate);
    return () => {
      window.removeEventListener("lexitrace_queue_updated", handleQueueUpdate);
    };
  }, [activeItem]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.classList.add(nextTheme);
    document.documentElement.classList.remove(theme);
  };

  const selectItem = (item: IngestDocument) => {
    setActiveItem(item);
    setEditedText(item.text);
    setEditedPage(item.page_number);
    setEditedSource(item.source_pdf);
    setStatusMessage(null);
  };

  const handleApprove = async () => {
    if (!activeItem || actioning) return;

    // Track original states for optimistic rollback
    const originalQueue = [...queue];
    const originalActiveItem = activeItem;
    const originalText = editedText;
    const originalPage = editedPage;
    const originalSource = editedSource;

    // Optimistically update the UI queue
    const updatedQueue = queue.filter(item => item.id !== activeItem.id);
    setQueue(updatedQueue);
    if (updatedQueue.length > 0) {
      selectItem(updatedQueue[0]);
    } else {
      setActiveItem(null);
    }

    setActioning(true);
    setStatusMessage(null);

    const approvedItem = {
      id: originalActiveItem.id,
      text: originalText,
      source_pdf: originalSource,
      page_number: Number(originalPage),
      confidence_score: 1.0
    };

    try {
      const response = await fetch("http://localhost:8000/api/review/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(approvedItem),
      });

      if (!response.ok) {
        throw new Error("Ingestion node returned an error status.");
      }

      setStatusMessage({ 
        type: "success", 
        text: `Document chunk [${originalActiveItem.id}] approved and indexed into Qdrant.` 
      });

    } catch (error) {
      console.error("Approve request failed:", error);
      
      // Rollback optimistic state removal
      setQueue(originalQueue);
      setActiveItem(originalActiveItem);
      setEditedText(originalText);
      setEditedPage(originalPage);
      setEditedSource(originalSource);

      setStatusMessage({ 
        type: "error", 
        text: `Failed to index document: ${error instanceof Error ? error.message : "Connection failed"}. Restored card to queue.` 
      });
    } finally {
      setActioning(false);
    }
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
              className="flex items-center gap-3 px-4 py-3 border-l-2 border-interactive-accent bg-bg-surface text-text-primary font-bold transition-all rounded-r-md"
            >
              <LayoutDashboard className="w-5 h-5 text-interactive-accent" />
              <span>HITL Review Queue</span>
            </Link>
            <Link 
              href="/status" 
              className="flex items-center justify-between px-4 py-3 border-l-2 border-transparent text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-all rounded-r-md font-medium"
            >
              <span className="flex items-center gap-3">
                <Activity className="w-5 h-5" />
                <span>System Status</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-critical-bg text-critical-text text-[10px] font-bold shadow-sm">2</span>
            </Link>
          </nav>
        </div>

        {/* Sidebar Footer with Theme Toggle */}
        <div className="p-4 border-t border-border-subtle space-y-4">
          
          <div className="bg-bg-surface p-3 rounded-xl border border-border-subtle shadow-inner">
            <h4 className="text-[10px] text-text-secondary font-bold uppercase tracking-wide">Queue Status</h4>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-extrabold text-text-primary">{queue.length}</span>
              <span className="text-[10px] text-text-secondary">items pending</span>
            </div>

          </div>

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
            onClick={fetchQueue}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-bg-surface hover:bg-bg-sidebar border border-border-subtle text-xs text-text-primary font-semibold cursor-pointer transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-text-secondary" />
            Refresh Queue
          </button>
        </div>
      </aside>

      {/* Main Review Workplace */}
      <main className="flex-1 flex flex-col min-w-0 bg-bg-canvas">
        
        {/* Top Header */}
        <header className="h-16 bg-bg-sidebar/90 border-b border-border-subtle flex items-center justify-between px-6 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3 md:hidden">
            <span className="font-extrabold tracking-wider text-text-primary">LexiTrace</span>
          </div>
          <h2 className="hidden md:block font-bold text-text-primary text-base tracking-wide">Human-In-The-Loop Validation Workstation</h2>
          <div className="flex gap-2">
            <Link 
              href="/chat" 
              className="md:hidden px-3 py-1.5 rounded bg-bg-sidebar text-text-secondary text-xs font-semibold border border-border-subtle"
            >
              Chat
            </Link>
            <Link 
              href="/review" 
              className="md:hidden px-3 py-1.5 rounded bg-secondary-accent-bg text-secondary-accent-text text-xs font-semibold border border-interactive-accent/25"
            >
              HITL Queue ({queuePendingCount})
            </Link>
            <Link 
              href="/status" 
              className="md:hidden px-3 py-1.5 rounded bg-bg-sidebar text-text-secondary text-xs font-semibold border border-border-subtle"
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

        {loading && queue.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <RefreshCw className="w-10 h-10 text-interactive-accent animate-spin mb-4" />
            <span className="text-text-secondary">Loading validation items...</span>
          </div>
        ) : activeItem ? (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            
            {/* LEFT PANEL: Mock Scanned Document Viewer */}
            <div className="flex-1 p-6 overflow-y-auto border-b lg:border-b-0 lg:border-r border-border-subtle flex flex-col space-y-4 custom-scrollbar">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary font-bold uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-interactive-accent" />
                  Original Document Scan
                </span>
                <span className="text-xs bg-warning-bg text-warning-text border border-warning-text/20 px-2.5 py-0.5 rounded-full font-mono font-semibold">
                  OCR Confidence: {Math.round(activeItem.confidence_score * 100)}%
                </span>
              </div>
              
              {/* PDF Representation Sheet */}
              <div className="flex-1 bg-slate-50 border border-slate-200 text-slate-850 p-8 shadow-xl rounded-xl relative select-none font-sans min-h-[400px] flex flex-col justify-between paper-shadow">
                <div className="absolute top-3 right-4 text-[9px] text-slate-400 font-mono">
                  SCAN FILE: {activeItem.source_pdf} (PAGE {activeItem.page_number})
                </div>
                
                {/* Header Mock */}
                <div className="border-b border-slate-200 pb-4 mb-6">
                  <div className="h-6 w-32 bg-slate-200 rounded mb-2"></div>
                  <div className="h-4 w-48 bg-slate-150 rounded"></div>
                </div>
                
                {/* Document Body Mock */}
                <div className="flex-1 space-y-6">
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-slate-150 rounded"></div>
                    <div className="h-4 w-11/12 bg-slate-150 rounded"></div>
                  </div>

                  {/* Highlighted Zone mimicking OCR uncertainty - clean translucent warm tint overlay */}
                  <div 
                    style={{ backgroundColor: "rgba(245, 158, 11, 0.12)" }}
                    className="p-5 border-l-4 border-warning-text rounded-r-lg relative overflow-hidden transition-all shadow-xs"
                  >
                    <div className="absolute top-1.5 right-2 text-[8px] text-warning-text/75 font-mono uppercase font-bold tracking-wider">
                      Low Confidence Data Block
                    </div>
                    <div className="font-mono text-xs whitespace-pre-wrap leading-relaxed pt-2 text-[#78350F] dark:text-[#F8FAFC] font-semibold">
                      {activeItem.text}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="h-4 w-5/6 bg-slate-150 rounded"></div>
                    <div className="h-4 w-full bg-slate-150 rounded"></div>
                  </div>
                </div>
                
                {/* Footer Mock */}
                <div className="border-t border-slate-200 pt-4 mt-6 text-center text-[9px] text-slate-350 font-mono tracking-widest uppercase">
                  Confidential - Internal LexiTrace OCR scan sheet
                </div>
              </div>
            </div>

            {/* RIGHT PANEL: Text/Markdown Editor */}
            <div className="w-full lg:w-[480px] bg-bg-sidebar p-6 overflow-y-auto flex flex-col justify-between shrink-0 border-t lg:border-t-0 border-border-subtle custom-scrollbar">
              <div className="space-y-6">
                <span className="text-xs text-text-secondary font-bold uppercase tracking-wider flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-interactive-accent" />
                  Structured Data Editor
                </span>
                
                {/* Status message */}
                {statusMessage && (
                  <div className={`p-4 rounded-xl border flex gap-3 text-xs leading-relaxed ${
                    statusMessage.type === "success" 
                      ? "bg-emerald-550/10 border-emerald-500/20 text-emerald-500 font-medium" 
                      : "bg-critical-bg border-critical-text/20 text-critical-text font-medium"
                  }`}>
                    <CheckCircle className="w-5 h-5 shrink-0" />
                    <div>{statusMessage.text}</div>
                  </div>
                )}

                {/* Form Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] text-slate-500 dark:text-slate-450 font-bold mb-1.5 uppercase tracking-wide">Source File</label>
                    <input 
                      type="text" 
                      value={editedSource}
                      onChange={(e) => setEditedSource(e.target.value)}
                      className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-interactive-accent shadow-inner"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-slate-450 font-bold mb-1.5 uppercase tracking-wide">Page Number</label>
                      <input 
                        type="number" 
                        value={editedPage}
                        onChange={(e) => setEditedPage(Number(e.target.value))}
                        className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-interactive-accent shadow-inner"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 dark:text-slate-450 font-bold mb-1.5 uppercase tracking-wide">Data Block ID</label>
                      <input 
                        type="text" 
                        value={activeItem.id} 
                        disabled
                        className="w-full bg-bg-surface/50 border border-border-subtle/50 rounded-lg px-3 py-2.5 text-sm text-text-secondary cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 dark:text-slate-450 font-bold mb-1.5 uppercase tracking-wide">Extracted Text (Markdown/JSON)</label>
                    <textarea 
                      rows={12}
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      className="w-full bg-bg-surface border border-border-subtle rounded-lg px-4 py-3 text-sm font-mono text-text-primary focus:outline-none focus:border-interactive-accent shadow-inner leading-relaxed whitespace-pre-wrap custom-scrollbar"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t border-border-subtle flex gap-3 mt-6">
                <button
                  onClick={handleApprove}
                  disabled={actioning}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#3B82F6] dark:bg-[#6366F1] hover:opacity-90 text-white font-semibold shadow-md disabled:opacity-50 cursor-pointer transition-all active:scale-[0.98]"
                >
                  {actioning ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Indexing document...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      <span>Approve & Ingest to Qdrant</span>
                    </>
                  )}
                </button>
              </div>

            </div>

          </div>
        ) : (
          /* Queue Cleared Success Page */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mb-6 shadow-md shadow-emerald-500/5">
              <ClipboardCheck className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">HITL Queue Cleared!</h3>
            <p className="text-text-secondary text-sm leading-relaxed mb-6">
              All parsed document chunks have been reviewed, approved, and successfully indexed in Qdrant. Your RAG system is fully optimized.
            </p>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-interactive-accent hover:opacity-90 text-bg-surface font-semibold text-sm transition-all shadow-md"
            >
              <span>Go to Chat Interface</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

      </main>

    </div>
  );
}

    </div>
  );
}