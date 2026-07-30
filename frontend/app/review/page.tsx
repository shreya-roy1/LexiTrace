"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Activity,
  Settings,
  Layers,
  Menu
} from "lucide-react";
import { SettingsModal } from "../../components/SettingsModal";
import dynamic from "next/dynamic";

interface IngestDocument {
  id: string;
  text: string;
  source_pdf: string;
  page_number: number;
  confidence_score: number;
}

function ReviewPageContent() {
  const { isConnected, queuePendingCount } = useRealtime();
  const systemAlertsCount = queuePendingCount > 0 ? 1 : 0;

  const [queue, setQueue] = useState<IngestDocument[]>([]);
  const [activeItem, setActiveItem] = useState<IngestDocument | null>(null);
  const [editedText, setEditedText] = useState("");
  const [editedPage, setEditedPage] = useState<number>(0);
  const [editedSource, setEditedSource] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [uploadStep, setUploadStep] = useState<number | null>(null);

  const [historyLogs, setHistoryLogs] = useState([
    { source_pdf: "q3_financial_report.pdf", page_number: 3, date: "Today, 14:32" },
    { source_pdf: "cost_breakdown_2024.pdf", page_number: 5, date: "Today, 11:15" },
    { source_pdf: "compliance_charter_v2.pdf", page_number: 12, date: "Yesterday, 17:40" },
    { source_pdf: "ops_playbook_draft.docx", page_number: 1, date: "Yesterday, 09:12" },
  ]);

  const mockQueueRef = useRef<IngestDocument[]>([
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
  ]);
  
  // Theme and Sidebar collapse/resize states
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  // Mouse drag handler for resizable sidebar
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(180, Math.min(450, e.clientX));
      setSidebarWidth(newWidth);
      localStorage.setItem("sidebar_width", String(newWidth));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

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
      setQueue(mockQueueRef.current);
      if (mockQueueRef.current.length > 0 && !activeItem) {
        selectItem(mockQueueRef.current[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchQueue();
    
    // Retrieve sidebar collapse preference
    const savedSidebar = localStorage.getItem("sidebar_open");
    if (savedSidebar === "false") {
      setSidebarOpen(false);
    }

    // Retrieve sidebar width preference
    const savedWidth = localStorage.getItem("sidebar_width");
    if (savedWidth) {
      setSidebarWidth(parseInt(savedWidth));
    }
    
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

  const toggleSidebar = () => {
    setSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem("sidebar_open", String(next));
      return next;
    });
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
      mockQueueRef.current = mockQueueRef.current.filter(item => item.id !== originalActiveItem.id);

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

      setHistoryLogs(prev => [
        {
          source_pdf: originalSource,
          page_number: Number(originalPage),
          date: `Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        },
        ...prev
      ]);

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

  const handleHITLUpload = async (file: File) => {
    setActioning(true);
    setUploadStep(1);
    
    setTimeout(() => {
      setUploadStep(2);
      
      setTimeout(() => {
        setUploadStep(3);
        
        setTimeout(async () => {
          setUploadStep(4);
          
          const reader = new FileReader();
          reader.onload = async (e) => {
            let text = e.target?.result as string;
            if (!text || text.trim().length === 0) {
              text = `Low confidence scanned block from batch upload of '${file.name}'. Please review details and verify data accuracy. Product development salaries are estimated at $4.2M, but infrastructure requires $1.1M.`;
            }
            
            const newDoc = {
              id: "uploaded-" + Math.random().toString(36).substring(2, 9),
              text: text,
              source_pdf: file.name,
              page_number: 1,
              confidence_score: 0.70
            };

            mockQueueRef.current.push(newDoc);

            try {
              const response = await fetch("http://localhost:8000/api/ingest", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ documents: [newDoc] })
              });
              
              setTimeout(async () => {
                setUploadStep(null);
                setActioning(false);
                setStatusMessage({ type: "success", text: "Successfully ingested new batch. Processing..." });
                setTimeout(() => setStatusMessage(null), 5000);
                await fetchQueue();
              }, 1200);
            } catch (err) {
              console.error("Failed uploading document batch:", err);
              setTimeout(() => {
                setUploadStep(null);
                setActioning(false);
                setStatusMessage({ type: "success", text: "Simulated low-confidence document batch added to queue." });
                setTimeout(() => setStatusMessage(null), 4000);
                setQueue(prev => [...prev, newDoc]);
                setActiveItem(newDoc);
                setEditedText(newDoc.text);
                setEditedSource(newDoc.source_pdf);
                setEditedPage(newDoc.page_number);
              }, 1200);
            }
          };
          reader.readAsText(file);
        }, 1200);
      }, 1200);
    }, 1000);
  };

  return (
    <div className="flex h-screen bg-bg-canvas text-text-primary overflow-hidden font-sans">
      
      {/* Sidebar Navigation */}
      <aside 
        className={`bg-bg-sidebar/95 border-r border-border-subtle flex flex-col backdrop-blur-md z-20 relative shrink-0 ${
          isResizing ? "" : "transition-all duration-300 ease-in-out"
        } ${
          sidebarOpen ? "opacity-100" : "opacity-0 overflow-hidden border-r-0 pointer-events-none"
        }`}
        style={{ width: sidebarOpen ? `${sidebarWidth}px` : '0px' }}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3">
            {/* High-tech Glowing Icon */}
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/35 shadow-[0_0_15px_rgba(56,189,248,0.25)] overflow-hidden">
              <div className="absolute inset-0 bg-cyan-500/10 animate-pulse"></div>
              <Layers className="w-4.5 h-4.5 text-[#38BDF8] shrink-0" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-widest text-text-primary uppercase block">LexiTrace</span>
              <span className="text-[8px] text-text-secondary font-bold uppercase tracking-widest block -mt-0.5">Enterprise RAG</span>
            </div>
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar">
          <nav className="space-y-1">
            <Link 
              href="/chat" 
              className="flex items-center gap-3 px-4 py-3 border-l-2 border-transparent text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-all rounded-r-md font-medium"
            >
              <MessageSquare className="w-5 h-5" />
              <span>Conversational Chat</span>
            </Link>
            <Link 
              href="/review" 
              className="flex items-center justify-between px-4 py-3 border-l-2 border-interactive-accent bg-bg-surface text-text-primary font-bold transition-all rounded-r-md"
            >
              <span className="flex items-center gap-3">
                <LayoutDashboard className="w-5 h-5 text-interactive-accent" />
                <span>HITL Review Queue</span>
              </span>
              {queue.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-critical-bg text-critical-text text-[10px] font-bold shadow-xs">
                  {queue.length}
                </span>
              )}
            </Link>
            <Link 
              href="/status" 
              className="flex items-center justify-between px-4 py-3 border-l-2 border-transparent text-text-secondary hover:bg-bg-surface hover:text-text-primary transition-all rounded-r-md font-medium"
            >
              <span className="flex items-center gap-3">
                <Activity className="w-5 h-5" />
                <span>System Status</span>
              </span>
              {systemAlertsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-critical-bg text-critical-text text-[10px] font-bold shadow-sm">
                  {systemAlertsCount}
                </span>
              )}
            </Link>
          </nav>
        </div>

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
            
            <button 
              onClick={fetchQueue}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-bg-surface hover:bg-bg-sidebar border border-border-subtle text-xs text-text-primary font-semibold cursor-pointer transition-all shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5 text-text-secondary" />
              Refresh Queue
            </button>
          </div>
        )}

        {/* Resize Handle */}
        {sidebarOpen && (
          <div 
            onMouseDown={startResizing}
            className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-interactive-accent/30 z-30 transition-all ${
              isResizing ? "bg-interactive-accent/50 w-1.5" : "bg-transparent"
            }`}
          />
        )}
      </aside>

      {/* Main Review Workplace */}
      <main className="flex-1 flex flex-col min-w-0 bg-bg-canvas">
        
        {/* Top Header */}
        <header className="h-16 bg-bg-sidebar/90 border-b border-border-subtle flex items-center justify-between px-6 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3">
            {/* Sidebar Collapse Toggle Button */}
            <button 
              onClick={toggleSidebar}
              className="p-2 rounded-lg border border-border-subtle bg-bg-surface hover:bg-bg-sidebar text-text-secondary hover:text-text-primary transition-all cursor-pointer shadow-2xs hidden md:flex items-center justify-center shrink-0"
              title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              <Menu className="w-4.5 h-4.5" />
            </button>

            <div className="flex items-center gap-3 md:hidden">
              <span className="font-extrabold tracking-wider text-text-primary">LexiTrace</span>
            </div>
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
              <div className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 p-8 shadow-xl rounded-xl relative select-none font-sans min-h-[400px] flex flex-col justify-between paper-shadow">
                <div className="absolute top-3 right-4 text-[9px] text-slate-400 dark:text-slate-500 font-mono">
                  SCAN FILE: {activeItem.source_pdf} (PAGE {activeItem.page_number})
                </div>
                
                {/* Header Mock */}
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
                  <div className="h-6 w-32 bg-slate-200 dark:bg-slate-850 rounded mb-2"></div>
                  <div className="h-4 w-48 bg-slate-200/60 dark:bg-slate-850/60 rounded"></div>
                </div>
                
                {/* Document Body Mock */}
                <div className="flex-1 space-y-6">
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-slate-200/60 dark:bg-slate-850/60 rounded"></div>
                    <div className="h-4 w-11/12 bg-slate-200/60 dark:bg-slate-850/60 rounded"></div>
                  </div>

                  {/* Highlighted Zone mimicking OCR uncertainty - clean translucent warm tint overlay */}
                  <div 
                    className="p-5 border-l-4 border-amber-600 dark:border-amber-400 bg-amber-500/10 dark:bg-amber-500/15 rounded-r-lg relative overflow-hidden transition-all shadow-xs"
                  >
                    <div className="absolute top-1.5 right-2 text-[8px] text-amber-700 dark:text-amber-300 font-mono uppercase font-bold tracking-wider">
                      Low Confidence Data Block
                    </div>
                    <div className="font-mono text-xs whitespace-pre-wrap leading-relaxed pt-2 text-amber-900 dark:text-amber-100 font-semibold">
                      {activeItem.text}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="h-4 w-5/6 bg-slate-200/60 dark:bg-slate-850/60 rounded"></div>
                    <div className="h-4 w-full bg-slate-200/60 dark:bg-slate-850/60 rounded"></div>
                  </div>
                </div>
                
                {/* Footer Mock */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-6 text-center text-[9px] text-slate-400 dark:text-slate-500 font-mono tracking-widest uppercase">
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
          /* Dual Action Layout for Empty Queue */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden h-full">
            
            {/* LEFT PANEL: Drag-and-drop Batch Ingestion */}
            <div className="flex-1 p-8 flex flex-col justify-center border-b md:border-b-0 md:border-r border-border-subtle bg-bg-canvas/30 backdrop-blur-xs">
              <div className="max-w-md mx-auto w-full text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mb-4 mx-auto shadow-md shadow-emerald-500/5">
                  <ClipboardCheck className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-text-primary">HITL Queue Cleared!</h3>
                  <p className="text-text-secondary text-xs mt-1.5 leading-relaxed">
                    All document chunks reviewed. Select or drag-and-drop a new document batch to parse and queue for verification.
                  </p>
                </div>

                {/* Drag and Drop Box */}
                <div 
                  onClick={() => {
                    const fileInput = document.getElementById("hitl-upload-input");
                    if (fileInput) fileInput.click();
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) {
                      await handleHITLUpload(files[0]);
                    }
                  }}
                  className="border-2 border-dashed border-border-subtle hover:border-interactive-accent/50 rounded-2xl p-8 bg-bg-surface hover:bg-bg-sidebar/50 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 select-none py-10"
                >
                  <span className="p-3 rounded-full bg-secondary-accent-bg text-secondary-accent-text text-sm">
                    <FileText className="w-6 h-6 shrink-0" />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-text-primary block">Click to parse document</span>
                    <span className="text-[10px] text-text-secondary mt-1 block">Supports PDF, DOCX, TXT (Max 25MB)</span>
                  </div>
                </div>

                <input 
                  id="hitl-upload-input" 
                  type="file" 
                  accept=".pdf,.txt,.docx" 
                  className="hidden" 
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      await handleHITLUpload(files[0]);
                    }
                  }}
                />

                {uploadStep !== null && (
                  <div className="w-full space-y-1.5 text-left animate-[fadeIn_0.3s_ease-out]">
                    <div className="flex justify-between items-center text-[10px] font-bold text-text-secondary">
                      <span>
                        {uploadStep === 1 && "Uploading Document..."}
                        {uploadStep === 2 && "Parsing Layout / OCR..."}
                        {uploadStep === 3 && "Extracting Entities..."}
                        {uploadStep === 4 && "Routing to HITL Queue..."}
                      </span>
                      <span className="text-interactive-accent font-mono">{uploadStep * 25}%</span>
                    </div>
                    <div className="w-full bg-border-subtle h-1 rounded-full overflow-hidden">
                      <div 
                        className="h-1 bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${uploadStep * 25}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANEL: History logs of validated documents */}
            <div className="flex-1 p-8 flex flex-col overflow-y-auto bg-bg-sidebar/20 custom-scrollbar">
              <div className="max-w-2xl mx-auto w-full space-y-6">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">Validation History Log</h3>
                  <p className="text-[11px] text-text-secondary mt-0.5">Recently verified, corrected and ingested documents.</p>
                </div>

                <div className="border border-border-subtle rounded-2xl overflow-hidden bg-bg-surface shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-bg-sidebar border-b border-border-subtle text-[10px] uppercase font-bold text-text-secondary">
                        <th className="py-3 px-4">Document</th>
                        <th className="py-3 px-4">Page</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Date Verified</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle/50 text-xs text-text-primary">
                      {historyLogs.map((log, idx) => (
                        <tr key={idx} className="hover:bg-bg-sidebar/35 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-text-primary flex items-center gap-2">
                            <FileText className="w-4 h-4 text-text-secondary shrink-0" />
                            <span className="truncate max-w-[200px]" title={log.source_pdf}>{log.source_pdf}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-text-secondary">Pg {log.page_number}</td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
                              Verified
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-[10px] text-text-secondary">{log.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Link
                    href="/chat"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-interactive-accent hover:opacity-90 text-bg-surface font-bold text-xs transition-all shadow-md"
                  >
                    <span>Proceed to chat workspace</span>
                    <ChevronRight className="w-4.5 h-4.5" />
                  </Link>
                </div>
              </div>
            </div>

          </div>
        )}

      </main>

      <SettingsModal 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
        theme={theme} 
        toggleTheme={toggleTheme} 
      />
    </div>
  );
}

export default dynamic(() => Promise.resolve(ReviewPageContent), { ssr: false });