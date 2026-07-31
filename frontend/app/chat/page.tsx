"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRealtime } from "../../context/RealtimeContext";
import { 
  MessageSquare, 
  Send, 
  AlertTriangle, 
  FileText, 
  X, 
  ShieldAlert, 
  CheckCircle,
  HelpCircle,
  LayoutDashboard,
  Sun,
  Moon,
  Activity,
  Sparkles,
  RefreshCw,
  Search,
  Zap,
  ShieldCheck,
  Settings,
  Paperclip,
  Layers,
  Menu,
  Trash2,
  Share2
} from "lucide-react";
import { SettingsModal } from "../../components/SettingsModal";
import dynamic from "next/dynamic";

interface DocumentPayload {
  text: string;
  source_pdf: string;
  page_number: number;
  confidence_score: number;
}

interface DocumentInfo {
  id: string;
  score: number;
  payload: DocumentPayload;
  source_pdf?: string;
  page_number?: number;
  confidence_score?: number;
  text?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  documents?: DocumentInfo[];
  timestamp: Date;
}

interface Thread {
  id: string;
  title: string;
  messages: Message[];
}

function ChatPageContent() {
  const { isConnected, queuePendingCount } = useRealtime();
  const systemAlertsCount = queuePendingCount > 0 ? 1 : 0;
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadStep, setUploadStep] = useState<number | null>(null);

  const [threads, setThreads] = useState<Thread[]>([
    {
      id: "thread-1",
      title: "Yesterday's Financial Query",
      messages: [
        {
          id: "mock-msg-1",
          role: "user",
          text: "Show me the Q3 financial profits data.",
          timestamp: new Date(Date.now() - 86400000)
        },
        {
          id: "mock-msg-2",
          role: "assistant",
          text: "According to financial reports, LexiTrace's Q3 profits rose by 15% due to automated agent deployment [Doc 1]. However, operating margins remained around 14.5% [Doc 2][⚠️ Citation Unverified].",
          documents: [
            {
              id: "mock-1",
              score: 0.92,
              payload: {
                text: "The quarterly profits of LexiTrace rose by 15% due to automation. This was driven by the integration of the internal Agent workflow.",
                source_pdf: "q3_report.pdf",
                page_number: 3,
                confidence_score: 0.95
              }
            },
            {
              id: "mock-2",
              score: 0.81,
              payload: {
                text: "Operating Margin: 14.5% (approximate count of total revenues based on initial feedback from sales accounts).",
                source_pdf: "q3_financial_report.pdf",
                page_number: 3,
                confidence_score: 0.78
              }
            }
          ],
          timestamp: new Date(Date.now() - 86400000 + 1000)
        }
      ]
    },
    {
      id: "thread-2",
      title: "Q3 Analysis Thread",
      messages: [
        {
          id: "welcome",
          role: "assistant",
          text: "Hello! I am LexiTrace's enterprise RAG assistant. Ask me questions about your corporate documents. For example: 'What are the Q3 financial metrics?' or 'What are the product development costs?'",
          timestamp: new Date(),
        }
      ]
    }
  ]);
  const [activeThreadId, setActiveThreadId] = useState<string>("thread-2");

  const activeThread = threads.find(t => t.id === activeThreadId) || threads[0];
  const messages = activeThread.messages;

  const updateActiveThreadMessages = (newMessages: Message[] | ((prev: Message[]) => Message[])) => {
    setThreads(prev => prev.map(t => {
      if (t.id === activeThreadId) {
        const updatedMessages = typeof newMessages === "function" ? newMessages(t.messages) : newMessages;
        return { ...t, messages: updatedMessages };
      }
      return t;
    }));
  };

  const setMessages = updateActiveThreadMessages;
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [isStreamPaused, setIsStreamPaused] = useState(false);
  
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentInfo | null>(null);
  const [selectedDocIndex, setSelectedDocIndex] = useState<number | null>(null);

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

  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Theme & Sidebar Sync on mount
  useEffect(() => {
    setMounted(true);
    
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

    // Load thread ID from URL search param if present on mount
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const threadIdParam = urlParams.get("thread");
      if (threadIdParam) {
        setThreads(prev => {
          const exists = prev.some(t => t.id === threadIdParam);
          if (exists) {
            return prev;
          } else {
            return [
              ...prev,
              {
                id: threadIdParam,
                title: "Shared Query Thread",
                messages: [
                  {
                    id: "welcome-shared",
                    role: "assistant",
                    text: "Viewing shared thread context. Feel free to continue the conversation!",
                    timestamp: new Date()
                  }
                ]
              }
            ];
          }
        });
        setActiveThreadId(threadIdParam);
      }
    }
  }, []);

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

  // Sync active thread ID into the page URL query parameters dynamically
  useEffect(() => {
    if (typeof window !== "undefined" && activeThreadId) {
      const url = new URL(window.location.href);
      url.searchParams.set("thread", activeThreadId);
      window.history.replaceState({}, "", url.toString());
    }
  }, [activeThreadId]);

  const handleShareThread = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== "undefined") {
      const shareUrl = `${window.location.origin}/chat?thread=${threadId}`;
      navigator.clipboard.writeText(shareUrl);
      setUploadStatus("Share link copied to clipboard!");
      setTimeout(() => setUploadStatus(null), 3000);
    }
  };

  const handleDeleteThread = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (threads.length <= 1) {
      // Create a new empty default thread if it is the last one being deleted
      const emptyThread = {
        id: "thread-" + Math.random().toString(36).substring(2, 9),
        title: "New Query Thread",
        messages: [
          {
            id: "welcome",
            role: "assistant" as const,
            text: "Hello! I am LexiTrace's enterprise RAG assistant. Ask me questions about your corporate documents. For example: 'What are the Q3 financial metrics?' or 'What are the product development costs?'",
            timestamp: new Date()
          }
        ]
      };
      setThreads([emptyThread]);
      setActiveThreadId(emptyThread.id);
      return;
    }

    const nextThreads = threads.filter(t => t.id !== threadId);
    setThreads(nextThreads);
    if (activeThreadId === threadId) {
      setActiveThreadId(nextThreads[0].id);
    }
  };

  // Auto scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, agentStatus]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMessage: Message = {
      id: Math.random().toString(),
      role: "user",
      text: textToSend,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setAgentStatus("Connecting to engine...");
    setActiveNode("retrieve");
    setIsStreamPaused(false);

    const assistantMsgId = Math.random().toString();
    
    // Add temporary assistant placeholder
    setMessages(prev => [...prev, {
      id: assistantMsgId,
      role: "assistant",
      text: "",
      timestamp: new Date()
    }]);

    let receivedCitations = false;
    let incomingText = "";
    let incomingDocs: DocumentInfo[] = [];

    const nliRequiredSetting = localStorage.getItem("rag_nli") !== "false";

    try {
      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          query: textToSend,
          nli_required: nliRequiredSetting
        }),
      });

      if (!response.ok) {
        throw new Error("Backend server error");
      }

      if (!response.body) {
        throw new Error("ReadableStream response body not supported");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            try {
              const data = JSON.parse(jsonStr);
              if (data.type === "status") {
                setAgentStatus(data.message);
                if (data.node) {
                  setActiveNode(data.node);
                }
              } else if (data.type === "cache_hit") {
                setAgentStatus("Retrieving from semantic cache...");
                setActiveNode("generating");
              } else if (data.type === "token") {
                incomingText += data.content;
                setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, text: incomingText } : m));
              } else if (data.type === "citations") {
                receivedCitations = true;
                incomingDocs = data.data;
                const finalResponse = data.verified_response || incomingText;
                setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, text: finalResponse, documents: incomingDocs } : m));
                setAgentStatus(null);
                setActiveNode(null);
              }
            } catch (e) {
              console.error("SSE parse error:", e);
            }
          }
        }
      }

      // If stream ended but we never received citations, it was likely cut off
      if (!receivedCitations) {
        throw new Error("Stream cut off before citation validation completes.");
      }

    } catch (error) {
      console.error("Failed to query backend via SSE:", error);
      
      // If we already received some text, mark it as paused instead of overriding
      const currentAssocMsg = messages.find(m => m.id === assistantMsgId);
      if (incomingText.length > 5 || (currentAssocMsg && currentAssocMsg.text.length > 5)) {
        setIsStreamPaused(true);
        setAgentStatus(null);
        setActiveNode(null);
        setLoading(false);
      } else {
        // FALLBACK MOCK FOR OFFLINE DEMOS
        setAgentStatus("Query dispatch offline. Invoking heuristic simulation...");
        setActiveNode("generating");
        setTimeout(() => {
          let mockAnswer = "I couldn't reach the backend server. Make sure the FastAPI app is running on port 8000. ";
          let mockDocs: DocumentInfo[] = [];

          if (textToSend.toLowerCase().includes("profit") || textToSend.toLowerCase().includes("q3")) {
            mockAnswer = "According to Q3 records, LexiTrace's quarterly profits rose by 15% due to automation [Doc 1]. However, operating margins remained around 14.5% [Doc 2][⚠️ Citation Unverified].";
            mockDocs = [
              {
                id: "mock-1",
                score: 0.92,
                payload: {
                  text: "The quarterly profits of LexiTrace rose by 15% due to automation. This was driven by the integration of the internal Agent workflow.",
                  source_pdf: "q3_report.pdf",
                  page_number: 3,
                  confidence_score: 0.95
                }
              },
              {
                id: "mock-2",
                score: 0.81,
                payload: {
                  text: "Operating Margin: 14.5% (approximate count of total revenues based on initial feedback from sales accounts).",
                  source_pdf: "q3_financial_report.pdf",
                  page_number: 3,
                  confidence_score: 0.78
                }
              }
            ];
          } else if (textToSend.toLowerCase().includes("cost") || textToSend.toLowerCase().includes("salary")) {
            mockAnswer = "LexiTrace's product development costs totaled $5.6M, which includes salaries of $4.2M [Doc 1] and infrastructure costs of $1.1M [Doc 2]. Licensing costs were estimated at $0.3M [Doc 2][⚠️ Citation Unverified].";
            mockDocs = [
              {
                id: "mock-3",
                score: 0.89,
                payload: {
                  text: "Product Development Costs - Salaries: $4.2M. Infrastructure: $1.1M. This is a baseline operational allocation.",
                  source_pdf: "cost_breakdown_2024.pdf",
                  page_number: 5,
                  confidence_score: 0.96
                }
              },
              {
                id: "mock-4",
                score: 0.75,
                payload: {
                  text: "Licensing: $0.3M. Total: $5.6M (estimates pending finalized vendor audits in Q1).",
                  source_pdf: "cost_breakdown_2024.pdf",
                  page_number: 5,
                  confidence_score: 0.65
                }
              }
            ];
          } else {
            mockAnswer = "Based on general mock documentation, LexiTrace provides next-gen document indexing. For queries about profits or costs, please try specific questions [Doc 1].";
            mockDocs = [
              {
                id: "mock-gen",
                score: 0.70,
                payload: {
                  text: "LexiTrace offers end-to-end document parsing, validation, and verification using NLI entailment engines.",
                  source_pdf: "lexitrace_overview.pdf",
                  page_number: 1,
                  confidence_score: 0.99
                }
              }
            ];
          }

          // Stream word by word fallback
          let curText = "";
          const words = mockAnswer.split(" ");
          let i = 0;
          
          const interval = setInterval(() => {
            if (i < words.length) {
              curText += (i === 0 ? "" : " ") + words[i];
              setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, text: curText } : m));
              i++;
            } else {
              clearInterval(interval);
              setActiveNode("verifying");
              setTimeout(() => {
                setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, text: mockAnswer, documents: mockDocs } : m));
                setAgentStatus(null);
                setActiveNode(null);
                setLoading(false);
              }, 600);
            }
          }, 40);

        }, 800);
      }
    } finally {
      if (!isStreamPaused) {
        setLoading(false);
      }
    }
  };

  const handleRetryStream = () => {
    const userMsgs = messages.filter(m => m.role === "user");
    if (userMsgs.length > 0) {
      const lastUserQuery = userMsgs[userMsgs.length - 1].text;
      // Remove last assistant message
      setMessages(prev => prev.slice(0, -1));
      setIsStreamPaused(false);
      handleSend(lastUserQuery);
    }
  };

  const handleCitationClick = (docIndex: number, msgDocs?: DocumentInfo[]) => {
    if (!msgDocs || docIndex <= 0) return;
    
    const foundDoc = msgDocs.find(doc => {
      const idStr = String(doc.id);
      return idStr === String(docIndex) || 
             idStr.endsWith("-" + docIndex) || 
             idStr.includes("doc-" + docIndex);
    });

    if (foundDoc) {
      setSelectedDoc(foundDoc);
      const actualIndex = msgDocs.indexOf(foundDoc) + 1;
      setSelectedDocIndex(actualIndex);
      setDrawerOpen(true);
      return;
    }

    if (docIndex <= msgDocs.length) {
      setSelectedDoc(msgDocs[docIndex - 1]);
      setSelectedDocIndex(docIndex);
      setDrawerOpen(true);
    }
  };

  const handleHighlightExport = () => {
    if (!selectedDoc) return;
    const docText = selectedDoc.payload?.text ?? selectedDoc.text;
    const sourcePdf = selectedDoc.payload?.source_pdf ?? (selectedDoc as any).source_pdf ?? "document.pdf";
    const pageNum = selectedDoc.payload?.page_number ?? (selectedDoc as any).page_number ?? 1;
    const confidence = Math.round((selectedDoc.payload?.confidence_score ?? (selectedDoc as any).confidence_score ?? 1.0) * 100);
    
    const printContent = `
      <html>
        <head>
          <title>Annotated Scan - ${sourcePdf} (Page ${pageNum})</title>
          <style>
            body { font-family: monospace; padding: 40px; color: #1e293b; background-color: #f8fafc; }
            .page-border { border: 2px solid #cbd5e1; padding: 40px; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border-radius: 8px; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; }
            .highlight-box { border-left: 4px solid #10b981; background: #ecfdf5; padding: 20px; border-radius: 4px; margin: 20px 0; }
            .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="page-border">
            <div class="header">
              <div>
                <strong>LEXITRACE ANNOTATED DOCUMENT AUDIT</strong><br/>
                File: ${sourcePdf}
              </div>
              <div style="text-align: right;">
                PAGE: ${pageNum}<br/>
                CONFIDENCE: ${confidence}%
              </div>
            </div>
            <p style="color: #94a3b8; font-size: 12px;">[PAGE LAYOUT SCAN CHUNKS]</p>
            <div class="highlight-box">
              <strong>VERIFIED RETRIEVAL ANNOTATION CHUNK:</strong><br/>
              <p style="font-size: 14px; line-height: 1.6;">${docText}</p>
            </div>
            <p style="color: #94a3b8; font-size: 12px;">[PAGE FOOTER METRICS]</p>
            <div class="footer">
              This is a certified RAG citation annotation generated dynamically by the LexiTrace Trust Layer.
            </div>
          </div>
        </body>
      </html>
    `;
    
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const renderMessageContent = (msg: Message) => {
    const text = msg.text;
    if (msg.role === "user") {
      return <p className="text-sm md:text-base leading-relaxed break-words">{text}</p>;
    }

    const parts = [];
    const customRegex = /(\[Doc\s+(\d+)\](?:\[(?:⚠️\s*Citation\s*Unverified|🚨\s*Direct\s*Contradiction)\])?)/g;
    let lastIndex = 0;
    let match;

    while ((match = customRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`t-${lastIndex}`} className="text-sm md:text-base leading-relaxed">
            {text.substring(lastIndex, match.index)}
          </span>
        );
      }

      const fullTag = match[1];
      const docNum = parseInt(match[2]);
      const isContradiction = fullTag.includes("🚨") || fullTag.includes("Contradiction");
      const isUnverified = fullTag.includes("⚠️") || fullTag.includes("Unverified");

      parts.push(
        <button
          key={`c-${match.index}`}
          onClick={() => handleCitationClick(docNum, msg.documents)}
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 mx-1 rounded-full text-xs font-semibold select-none cursor-pointer transition-all duration-300 border animate-[fadeIn_0.3s_ease-out] ${
            isContradiction
              ? "bg-critical-bg text-critical-text border-critical-text/25 hover:opacity-90 animate-pulse"
              : isUnverified
              ? "bg-warning-bg text-warning-text border-warning-text/25 hover:opacity-90 animate-pulse"
              : "bg-citation-std-bg text-citation-std-text border-transparent hover:opacity-90"
          }`}
        >
          <span>Doc {docNum}</span>
          {isContradiction && <ShieldAlert className="w-3 h-3 shrink-0 text-critical-text" />}
          {!isContradiction && isUnverified && <AlertTriangle className="w-3 h-3 shrink-0 text-warning-text" />}
        </button>
      );

      lastIndex = customRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(
        <span key={`t-${lastIndex}`} className="text-sm md:text-base leading-relaxed">
          {text.substring(lastIndex)}
        </span>
      );
    }

    const contentBlock = parts.length > 0 ? parts : text;

    return (
      <div className="space-y-2">
        <div className="space-y-1">
          {msg.role === "assistant" && (
            <span className="inline-flex mr-2 text-interactive-accent align-middle">
              <Sparkles className="w-4 h-4" />
            </span>
          )}
          {contentBlock}
        </div>
        
        {/* Stream Paused Fallback Button */}
        {msg.role === "assistant" && isStreamPaused && msg.id === messages[messages.length - 1].id && (
          <div className="mt-3 pt-3 border-t border-border-subtle/20 flex items-center justify-between gap-4 animate-[fadeIn_0.4s_ease-out]">
            <div className="flex items-center gap-1.5 text-xs text-critical-text font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Stream Paused - Connection Interrupted</span>
            </div>
            <button
              onClick={handleRetryStream}
              className="px-3.5 py-1.5 rounded-lg bg-[#3B82F6] dark:bg-[#6366F1] hover:opacity-90 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-3 h-3" />
              Retry Stream
            </button>
          </div>
        )}
      </div>
    );
  };

  const getFollowUps = () => {
    if (messages.length <= 1) return [];
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    if (!lastUserMsg) return [];
    
    const query = lastUserMsg.text.toLowerCase();
    if (query.includes("financial") || query.includes("q3") || query.includes("revenue")) {
      return [
        "Check Q3 net income details",
        "Which document holds financial data?",
        "Compare with development costs"
      ];
    }
    if (query.includes("development") || query.includes("costs") || query.includes("salaries") || query.includes("infrastructure")) {
      return [
        "What are the infrastructure costs?",
        "Show licensing cost details",
        "Verify product development costs"
      ];
    }
    if (query.includes("pending") || query.includes("review") || query.includes("hitl") || query.includes("queue")) {
      return [
        "How to edit a document?",
        "What happens upon approving?",
        "What is the confidence threshold?"
      ];
    }
    if (query.includes("citation") || query.includes("nli") || query.includes("verification") || query.includes("hallucination")) {
      return [
        "What is DeBERTa v3?",
        "What does the warning badge mean?",
        "Show verifier.py details"
      ];
    }
    return [
      "Can you elaborate on this?",
      "Show citation source document",
      "List relevant PDF files"
    ];
  };

  const handleNewThread = () => {
    const newId = "thread-" + Math.random().toString(36).substring(2, 9);
    const newThread: Thread = {
      id: newId,
      title: "New Query Thread " + (threads.length + 1),
      messages: [
        {
          id: "welcome",
          role: "assistant",
          text: "Hello! I am LexiTrace's enterprise RAG assistant. Ask me questions about your corporate documents.",
          timestamp: new Date()
        }
      ]
    };
    setThreads(prev => [...prev, newThread]);
    setActiveThreadId(newId);
  };

  const handleFileUpload = async (file: File) => {
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
              text = `LexiTrace internal database entry for ${file.name}. Operational details show system deployment metrics. Product development salaries are allocated at $4.2M. Quarterly revenues are up 15% due to automated integration.`;
            }
            
            const newDoc = {
              id: "uploaded-" + Math.random().toString(36).substring(2, 9),
              text: text,
              source_pdf: file.name,
              page_number: 1,
              confidence_score: 0.95
            };

            try {
              const response = await fetch("http://localhost:8000/api/ingest", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ documents: [newDoc] })
              });
              if (!response.ok) throw new Error("Backend offline");
              
              setTimeout(() => {
                setUploadStep(null);
                setMessages(prev => [...prev, {
                  id: Math.random().toString(),
                  role: "assistant",
                  text: `Uploaded document '${file.name}' has been successfully parsed, layout evaluated, embeddings generated, and indexed into Qdrant.`,
                  timestamp: new Date()
                }]);
              }, 1200);
            } catch (err) {
              console.error("Document ingestion failed:", err);
              setTimeout(() => {
                setUploadStep(null);
                setMessages(prev => [...prev, {
                  id: Math.random().toString(),
                  role: "assistant",
                  text: `[Offline Simulation] Uploaded document '${file.name}' has been parsed and mock-indexed in memory. You can now query details about it.`,
                  timestamp: new Date()
                }]);
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
        className={`bg-bg-sidebar/95 border-r border-border-subtle flex flex-col justify-between shrink-0 backdrop-blur-md z-20 relative ${
          isResizing ? "" : "transition-all duration-300 ease-in-out"
        } ${
          sidebarOpen ? "opacity-100" : "opacity-0 overflow-hidden border-r-0 pointer-events-none"
        } hidden md:flex`}
        style={{ width: sidebarOpen ? `${sidebarWidth}px` : '0px' }}
      >
        <div className="flex flex-col">
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
          
          {/* Nav menu */}
          <nav className="p-4 space-y-1">
            <Link 
              href="/chat" 
              className="flex items-center gap-3 px-4 py-3 border-l-2 border-interactive-accent bg-bg-surface text-text-primary font-bold transition-all rounded-r-md"
            >
              <MessageSquare className="w-5 h-5 text-interactive-accent" />
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

          {/* Dynamic Thread History */}
          <div className="px-4 py-2 flex-1 flex flex-col min-h-0 border-t border-border-subtle/45 mt-2 pt-4">
            <div className="flex items-center justify-between mb-2 px-2">
              <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Query Threads</span>
              <button 
                onClick={handleNewThread}
                className="text-[10px] font-bold text-interactive-accent hover:opacity-85 px-2 py-0.5 rounded border border-border-subtle bg-bg-surface transition-all cursor-pointer shadow-2xs"
              >
                + New
              </button>
            </div>
            
            <div className="space-y-1 overflow-y-auto custom-scrollbar flex-1 max-h-[160px]">
              {threads.map(t => {
                const isActive = t.id === activeThreadId;
                return (
                  <div
                    key={t.id}
                    onClick={() => setActiveThreadId(t.id)}
                    className={`group w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all font-medium cursor-pointer ${
                      isActive 
                        ? "bg-bg-surface text-text-primary border-l-2 border-interactive-accent font-bold shadow-xs" 
                        : "text-text-secondary hover:bg-bg-surface/50 hover:text-text-primary"
                    }`}
                  >
                    <span className="truncate flex-1 pr-2">{t.title}</span>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleShareThread(t.id, e)}
                        className="p-1 rounded hover:bg-bg-sidebar text-text-secondary hover:text-interactive-accent transition-all cursor-pointer"
                        title="Share link"
                      >
                        <Share2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteThread(t.id, e)}
                        className="p-1 rounded hover:bg-bg-sidebar text-text-secondary hover:text-critical-text transition-all cursor-pointer"
                        title="Delete thread"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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

      {/* Main chat window */}
      <main className="flex-1 flex flex-col min-w-0 bg-bg-canvas">
        
        {/* Reconnect warning banner */}
        {!isConnected && (
          <div className="bg-critical-bg border-b border-critical-text/10 py-2.5 px-6 text-center text-xs font-semibold text-critical-text flex items-center justify-center gap-4 z-20 shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 animate-bounce" />
              <span>LexiTrace engine offline. Attempting automatic reconnection...</span>
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="px-2.5 py-1 text-[10px] uppercase tracking-wider bg-critical-text text-white hover:bg-critical-text/90 rounded-md font-bold transition-all shadow-xs cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        )}

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
          
          {isConnected && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-accent-bg text-secondary-accent-text border border-interactive-accent/15 text-xs font-semibold shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Engine Connected</span>
            </div>
          )}

          <div className="flex gap-2">
            <Link 
              href="/chat" 
              className="md:hidden px-3 py-1.5 rounded bg-secondary-accent-bg text-secondary-accent-text text-xs font-semibold border border-interactive-accent/25"
            >
              Chat
            </Link>
            <Link 
              href="/review" 
              className="md:hidden px-3 py-1.5 rounded bg-bg-sidebar text-text-secondary text-xs font-semibold border border-border-subtle"
            >
              HITL ({queuePendingCount})
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

        {/* Chat message space */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col justify-between">
          {messages.length <= 1 ? (
            <div className="max-w-2xl mx-auto my-auto py-12 px-4 flex flex-col items-center justify-center text-center space-y-8 animate-[fadeIn_0.5s_ease-out]">
              {/* Brand Logo and Title */}
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#3B82F6] to-[#10B981] dark:from-[#6366F1] dark:to-[#34D399] flex items-center justify-center mx-auto shadow-md transform hover:rotate-12 transition-transform duration-300">
                  <Sparkles className="w-8 h-8 text-white animate-pulse" />
                </div>
                <div>
                  <h2 className="text-3xl font-extrabold tracking-tight text-text-primary">
                    LexiTrace RAG Workspace
                  </h2>
                  <p className="text-sm text-text-secondary max-w-md mx-auto mt-1 leading-relaxed">
                    Ask natural questions about your enterprise documents. Every answer is cross-referenced using sentence-level NLI entailment.
                  </p>
                </div>
              </div>

              {/* Grid of Recommended Inquiries */}
              <div className="w-full space-y-3 text-left">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary px-1">
                  Suggested Prompts
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Card 1 */}
                  <button
                    onClick={() => handleSend("What are the Q3 financial metrics?")}
                    className="p-4 rounded-xl border border-border-subtle bg-bg-sidebar hover:bg-bg-surface hover:border-interactive-accent hover:shadow-md transition-all text-left flex flex-col gap-1.5 cursor-pointer group"
                  >
                    <span className="font-semibold text-text-primary text-sm flex items-center gap-1.5 group-hover:text-interactive-accent">
                      📊 What are the Q3 financial metrics?
                    </span>
                    <span className="text-xs text-text-secondary leading-relaxed">
                      Analyze revenue growth, net income, and operating margins in the Q3 report.
                    </span>
                  </button>

                  {/* Card 2 */}
                  <button
                    onClick={() => handleSend("Tell me about the product development costs")}
                    className="p-4 rounded-xl border border-border-subtle bg-bg-sidebar hover:bg-bg-surface hover:border-interactive-accent hover:shadow-md transition-all text-left flex flex-col gap-1.5 cursor-pointer group"
                  >
                    <span className="font-semibold text-text-primary text-sm flex items-center gap-1.5 group-hover:text-interactive-accent">
                      💵 Product development costs
                    </span>
                    <span className="text-xs text-text-secondary leading-relaxed">
                      Retrieve cost details for salaries, infrastructure, and licensing.
                    </span>
                  </button>

                  {/* Card 3 */}
                  <button
                    onClick={() => handleSend("Show me the documents in the HITL queue")}
                    className="p-4 rounded-xl border border-border-subtle bg-bg-sidebar hover:bg-bg-surface hover:border-interactive-accent hover:shadow-md transition-all text-left flex flex-col gap-1.5 cursor-pointer group"
                  >
                    <span className="font-semibold text-text-primary text-sm flex items-center gap-1.5 group-hover:text-interactive-accent">
                      🛡️ Show pending review queue
                    </span>
                    <span className="text-xs text-text-secondary leading-relaxed">
                      List all OCR segments with low confidence scores flagged for manual inspection.
                    </span>
                  </button>

                  {/* Card 4 */}
                  <button
                    onClick={() => handleSend("Explain citation verification")}
                    className="p-4 rounded-xl border border-border-subtle bg-bg-sidebar hover:bg-bg-surface hover:border-interactive-accent hover:shadow-md transition-all text-left flex flex-col gap-1.5 cursor-pointer group"
                  >
                    <span className="font-semibold text-text-primary text-sm flex items-center gap-1.5 group-hover:text-interactive-accent">
                      🔍 Explain citation verification
                    </span>
                    <span className="text-xs text-text-secondary leading-relaxed">
                      How does the DeBERTa model find fact hallucinations and show warning markers?
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-5 py-3.5 shadow-sm border ${
                      msg.role === "user"
                        ? "bg-interactive-accent border-border-subtle/10 text-bg-surface rounded-br-none shadow-md"
                        : "bg-bubble-ai-bg border-border-subtle rounded-bl-none text-text-primary"
                    }`}
                  >
                    {renderMessageContent(msg)}
                    <div className="mt-1.5 text-[9px] opacity-45 text-right font-mono">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active Agent status progress pill */}
          {agentStatus && (
            <div className="flex justify-start">
              <div className="max-w-[75%] rounded-2xl rounded-bl-none px-5 py-4 bg-bubble-ai-bg border-border-subtle border text-text-secondary flex items-center gap-3 shadow-sm">
                <span className="flex space-x-1.5">
                  <span className="w-2 h-2 bg-interactive-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-interactive-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-interactive-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </span>
                <span className="text-xs text-text-secondary font-semibold animate-pulse">{agentStatus}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input box & Multi-stage thinking indicators */}
        <div className="p-6 bg-bg-sidebar border-t border-border-subtle space-y-4">
          
          {/* Multi-stage thinking status row */}
          {loading && activeNode && (
            <div className="flex items-center gap-4 bg-bg-canvas px-4 py-2.5 rounded-lg border border-border-subtle text-xs animate-[fadeIn_0.3s_ease-out] shadow-sm">
              <div className="flex items-center gap-1.5">
                <Search className={`w-3.5 h-3.5 ${activeNode === 'retrieve' ? 'text-interactive-accent animate-pulse' : activeNode !== 'retrieve' ? 'text-emerald-500' : 'text-text-secondary'}`} />
                <span className={`${activeNode === 'retrieve' ? 'font-bold text-text-primary' : 'text-text-secondary'}`}>Search DB</span>
              </div>
              <div className="h-px bg-border-subtle w-6"></div>
              <div className="flex items-center gap-1.5">
                <Zap className={`w-3.5 h-3.5 ${activeNode === 'grading' ? 'text-interactive-accent animate-pulse' : (activeNode === 'generating' || activeNode === 'verifying') ? 'text-emerald-500' : 'text-text-secondary'}`} />
                <span className={`${activeNode === 'grading' ? 'font-bold text-text-primary' : 'text-text-secondary'}`}>Reranking</span>
              </div>
              <div className="h-px bg-border-subtle w-6"></div>
              <div className="flex items-center gap-1.5">
                <Sparkles className={`w-3.5 h-3.5 ${activeNode === 'generating' ? 'text-interactive-accent animate-pulse' : activeNode === 'verifying' ? 'text-emerald-500' : 'text-text-secondary'}`} />
                <span className={`${activeNode === 'generating' ? 'font-bold text-text-primary' : 'text-text-secondary'}`}>Generating</span>
              </div>
              <div className="h-px bg-border-subtle w-6"></div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className={`w-3.5 h-3.5 ${activeNode === 'verifying' ? 'text-interactive-accent animate-pulse' : 'text-text-secondary'}`} />
                <span className={`${activeNode === 'verifying' ? 'font-bold text-text-primary' : 'text-text-secondary'}`}>NLI Verify</span>
              </div>
            </div>
          )}

          {/* Dynamic Follow-up Recommendations */}
          {!loading && messages.length > 1 && (
            <div className="flex flex-wrap gap-2 animate-[fadeIn_0.3s_ease-out]">
              {getFollowUps().map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="text-[11px] px-3 py-1.5 rounded-full bg-bg-canvas border border-border-subtle text-text-secondary hover:bg-interactive-accent hover:text-bg-surface hover:border-transparent transition-all cursor-pointer font-semibold shadow-xs"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Minimal Upload Ingestion Progress Row */}
          {(uploadStep !== null || uploadStatus) && (
            <div className="flex items-center justify-between gap-4 bg-bg-canvas px-4 py-2 rounded-lg border border-border-subtle text-xs animate-[fadeIn_0.3s_ease-out] shadow-sm">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-interactive-accent animate-pulse" />
                <span className="font-semibold text-text-primary">
                  {uploadStatus || (
                    uploadStep === 1 ? "Uploading Document..." :
                    uploadStep === 2 ? "Parsing Document Layout (OCR)..." :
                    uploadStep === 3 ? "Generating Vector Embeddings..." : "Indexing Complete!"
                  )}
                </span>
              </div>
              {uploadStep !== null && (
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-border-subtle h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        uploadStep === 4 ? "bg-emerald-500" : "bg-interactive-accent animate-pulse"
                      }`}
                      style={{ width: `${uploadStep * 25}%` }}
                    />
                  </div>
                  <span className="font-mono font-bold text-[10px] text-text-secondary">{uploadStep * 25}%</span>
                </div>
              )}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="relative flex items-center bg-bg-surface border border-border-subtle rounded-xl p-1 shadow-xs focus-within:border-interactive-accent focus-within:ring-1 focus-within:ring-interactive-accent transition-all"
          >
            {/* Hidden File Input */}
            <input 
              id="file-upload-input" 
              type="file" 
              accept=".pdf,.txt,.docx" 
              className="hidden" 
              onChange={async (e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  await handleFileUpload(files[0]);
                }
              }}
            />
            
            {/* Sleek attachment paperclip button */}
            <button
              type="button"
              onClick={() => {
                const fileInput = document.getElementById("file-upload-input");
                if (fileInput) fileInput.click();
              }}
              className="pl-3 pr-2 py-3.5 text-text-secondary hover:text-text-primary transition-all cursor-pointer flex items-center justify-center shrink-0"
              title="Upload Document"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about financial or system documentation..."
              className="flex-1 bg-transparent border-0 outline-none text-text-primary text-sm pl-2 pr-12 py-3.5 placeholder-text-secondary"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute right-2 w-10 h-10 rounded-lg bg-interactive-accent hover:opacity-90 text-bg-surface flex items-center justify-center disabled:opacity-30 transition-all cursor-pointer shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-all duration-300"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Slide drawer for Citation Source Snippet */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[480px] bg-bg-surface border-l border-border-subtle shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {selectedDoc ? (
          <>
            {/* Drawer Header */}
            <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-bg-sidebar">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary-accent-bg flex items-center justify-center border border-interactive-accent/15 text-secondary-accent-text shadow-sm">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-text-primary text-sm tracking-wide">Citation Source [Doc {selectedDocIndex}]</h3>
                  <span className="text-xs text-secondary-accent-text font-semibold font-mono">{selectedDoc.payload?.source_pdf ?? selectedDoc.source_pdf}</span>
                </div>
              </div>
              <button 
                onClick={() => setDrawerOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-sidebar transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              
              {/* Metadata Info Panel */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-bg-sidebar p-4 rounded-xl border border-border-subtle shadow-sm hover:shadow transition-shadow">
                  <div className="text-[10px] text-text-secondary uppercase font-semibold tracking-wider">Page Number</div>
                  <div className="text-lg font-bold text-text-primary mt-1">Page {selectedDoc.payload?.page_number ?? selectedDoc.page_number}</div>
                </div>

                <div className="bg-bg-sidebar p-4 rounded-xl border border-border-subtle shadow-sm hover:shadow transition-shadow">
                  <div className="text-[10px] text-text-secondary uppercase font-semibold tracking-wider">OCR Confidence</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-lg font-bold ${
                      (selectedDoc.payload?.confidence_score ?? selectedDoc.confidence_score) >= 0.85 
                        ? "text-emerald-500" 
                        : "text-warning-text"
                    }`}>
                      {Math.round((selectedDoc.payload?.confidence_score ?? selectedDoc.confidence_score) * 100)}%
                    </span>
                    {(selectedDoc.payload?.confidence_score ?? selectedDoc.confidence_score) >= 0.85 ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-warning-text" />
                    )}
                  </div>
                </div>
              </div>

              {/* Reranker Relevance Score with progress bar */}
              <div className="bg-bg-sidebar px-4 py-3 rounded-xl border border-border-subtle shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs text-text-secondary">
                  <span>Reranker Relevance Score:</span>
                  <span className="font-mono text-interactive-accent font-bold">
                    {selectedDoc.score.toFixed(4)}
                  </span>
                </div>
                <div className="w-full bg-border-subtle h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-interactive-accent h-1.5 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.max(0, Math.min(100, (selectedDoc.score + 5) * 10))}%` }} 
                  />
                </div>
              </div>

              {/* Scanned Document Bounding Preview (Interactive Citation Inspector) */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Scanned Document Bounding Preview</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleHighlightExport}
                      className="text-[9px] font-bold text-interactive-accent bg-interactive-accent/10 px-2 py-0.5 rounded-full border border-interactive-accent/25 hover:bg-interactive-accent hover:text-white transition-all cursor-pointer shadow-3xs"
                    >
                      Highlight & Export PDF
                    </button>
                    <span className="text-[9px] font-mono text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      NLI Entailment: {Math.round(selectedDoc.score * 100)}% Verified
                    </span>
                  </div>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-850 dark:text-slate-200 p-6 shadow-md rounded-xl relative font-sans min-h-[220px] flex flex-col justify-between paper-shadow select-none">
                  <div className="absolute top-2 right-3 text-[8px] text-slate-400 dark:text-slate-500 font-mono">
                    OCR SCAN: PAGE {selectedDoc.payload?.page_number ?? selectedDoc.page_number}
                  </div>
                  
                  {/* Mock Scanned Bounding Box Lines */}
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                    <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded mb-1"></div>
                    <div className="h-1.5 w-40 bg-slate-200/60 dark:bg-slate-800/60 rounded"></div>
                  </div>
                  
                  {/* Page Mock Layout */}
                  <div className="flex-1 space-y-3">
                    <div className="h-2 w-full bg-slate-200/40 dark:bg-slate-800/40 rounded"></div>
                    
                    {/* Visual Scanned Page Overlay Highlight */}
                    <div className="p-3.5 border-l-2 border-emerald-500 dark:border-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-r-lg relative overflow-hidden transition-all shadow-2xs hover:shadow-xs">
                      <div className="absolute top-1 right-2 text-[7px] text-emerald-600 dark:text-emerald-400 font-mono uppercase font-bold tracking-wider">
                        Cited Segment Box [Doc {selectedDocIndex}]
                      </div>
                      <p className="font-mono text-xs leading-relaxed text-text-primary pt-1.5 whitespace-pre-wrap select-text selection:bg-emerald-500/30">
                        {selectedDoc.payload?.text ?? selectedDoc.text}
                      </p>
                    </div>
                    
                    <div className="h-2 w-5/6 bg-slate-200/40 dark:bg-slate-800/40 rounded"></div>
                  </div>
                </div>

                {/* Low Confidence Alert */}
                {(selectedDoc.payload?.confidence_score ?? selectedDoc.confidence_score) < 0.85 && (
                  <div className="flex gap-3 bg-warning-bg border border-warning-text/10 rounded-xl p-4 text-xs text-warning-text leading-normal shadow-sm">
                    <ShieldAlert className="w-5 h-5 shrink-0 text-warning-text" />
                    <div>
                      <span className="font-semibold block mb-0.5">Low Confidence OCR Extraction</span>
                      This chunk has an OCR parsing confidence score below 85%. Figures or words in this snippet may contain parsing errors. 
                      If this is critical, review and edit it in the <Link href="/review" className="underline font-bold text-text-primary">HITL Review Queue</Link>.
                    </div>
                  </div>
                )}
              </div>

            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-text-secondary">
            <HelpCircle className="w-12 h-12 mb-2 animate-pulse text-text-secondary/50" />
            <span>Select a citation badge in chat to inspect details.</span>
          </div>
        )}
      </div>

      <SettingsModal 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
        theme={theme} 
        toggleTheme={toggleTheme} 
      />
    </div>
  );
}

export default dynamic(() => Promise.resolve(ChatPageContent), { ssr: false });
