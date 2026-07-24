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
  Sun,
  Moon,
  Activity,
  RefreshCw,
  Search,
  Zap,
  ShieldCheck
} from "lucide-react";

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
}

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  documents?: DocumentInfo[];
  timestamp: Date;
}

export default function ChatPage() {
  const { isConnected, queuePendingCount } = useRealtime();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hello! I am LexiTrace's enterprise RAG assistant. Ask me questions about your corporate documents. For example: 'What are the Q3 financial metrics?' or 'What are the product development costs?'",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [isStreamPaused, setIsStreamPaused] = useState(false);
  
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentInfo | null>(null);
  const [selectedDocIndex, setSelectedDocIndex] = useState<number | null>(null);

  // Theme state
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Theme Sync on mount
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

    try {
      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: textToSend }),
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

  const renderMessageContent = (msg: Message) => {
    const text = msg.text;
    if (msg.role === "user") {
      return <p className="text-sm md:text-base leading-relaxed break-words">{text}</p>;
    }

    const parts = [];
    const customRegex = /(\[Doc\s+(\d+)\](?:\[⚠️\s*Citation\s*Unverified\])?)/g;
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
      const isUnverified = fullTag.includes("⚠️") || fullTag.includes("Unverified");

      parts.push(
        <button
          key={`c-${match.index}`}
          onClick={() => handleCitationClick(docNum, msg.documents)}
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 mx-1 rounded-full text-xs font-semibold select-none cursor-pointer transition-all duration-300 border animate-[fadeIn_0.3s_ease-out] ${
            isUnverified
              ? "bg-warning-bg text-warning-text border-warning-text/25 hover:opacity-90 animate-pulse"
              : "bg-citation-std-bg text-citation-std-text border-transparent hover:opacity-90"
          }`}
        >
          <span>Doc {docNum}</span>
          {isUnverified && <AlertTriangle className="w-3 h-3 shrink-0 text-warning-text" />}
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
              <span className="px-2 py-0.5 rounded-full bg-critical-bg text-critical-text text-[10px] font-bold shadow-sm">2</span>
            </Link>
          </nav>
        </div>

        {/* Sidebar Footer with Theme Toggle */}
        <div className="p-4 border-t border-border-subtle">
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

      {/* Main chat window */}
      <main className="flex-1 flex flex-col min-w-0 bg-bg-canvas">
        
        {/* Reconnect warning banner */}
        {!isConnected && (
          <div className="bg-critical-bg border-b border-critical-text/10 py-2 px-6 text-center text-xs font-semibold text-critical-text flex items-center justify-center gap-2 animate-pulse z-20">
            <AlertTriangle className="w-4 h-4" />
            <span>Reconnecting to live LexiTrace engine...</span>
          </div>
        )}

        {/* Top Header */}
        <header className="h-16 bg-bg-sidebar/90 border-b border-border-subtle flex items-center justify-between px-6 backdrop-blur-md z-10">
          <div className="flex items-center gap-3 md:hidden">
            <span className="font-extrabold tracking-wider text-text-primary">LexiTrace</span>
          </div>
          
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-accent-bg text-secondary-accent-text border border-interactive-accent/15 text-xs font-semibold shadow-xs">
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-critical-text"}`}></span>
            <span>{isConnected ? "Engine Connected" : "Engine Disconnected"}</span>
          </div>

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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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

          {/* Quick templates */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleSend("What are the Q3 financial metrics?")}
              className="text-xs px-3 py-1.5 rounded-full bg-secondary-accent-bg border border-interactive-accent/10 text-secondary-accent-text hover:bg-interactive-accent/5 transition-all cursor-pointer font-semibold shadow-xs"
            >
              What are the Q3 financial metrics?
            </button>
            <button
              onClick={() => handleSend("Tell me about the product development costs")}
              className="text-xs px-3 py-1.5 rounded-full bg-secondary-accent-bg border border-interactive-accent/10 text-secondary-accent-text hover:bg-interactive-accent/5 transition-all cursor-pointer font-semibold shadow-xs"
            >
              Tell me about product development costs
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="relative flex items-center bg-bg-surface border border-border-subtle rounded-xl p-1 shadow-xs focus-within:border-interactive-accent focus-within:ring-1 focus-within:ring-interactive-accent transition-all"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about financial or system documentation..."
              className="flex-1 bg-transparent border-0 outline-none text-text-primary text-sm pl-4 pr-12 py-3.5 placeholder-text-secondary"
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
                  <span className="text-xs text-secondary-accent-text font-semibold font-mono">{selectedDoc.payload.source_pdf}</span>
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
                  <div className="text-lg font-bold text-text-primary mt-1">Page {selectedDoc.payload.page_number}</div>
                </div>

                <div className="bg-bg-sidebar p-4 rounded-xl border border-border-subtle shadow-sm hover:shadow transition-shadow">
                  <div className="text-[10px] text-text-secondary uppercase font-semibold tracking-wider">OCR Confidence</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-lg font-bold ${
                      selectedDoc.payload.confidence_score >= 0.85 
                        ? "text-emerald-500" 
                        : "text-warning-text"
                    }`}>
                      {Math.round(selectedDoc.payload.confidence_score * 100)}%
                    </span>
                    {selectedDoc.payload.confidence_score >= 0.85 ? (
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

              {/* Snippet & Warning Group */}
              <div className="space-y-3">
                <label className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider">Extract Snippet</label>
                <div className="bg-bg-sidebar p-5 rounded-xl border border-border-subtle text-text-primary text-sm leading-relaxed font-mono whitespace-pre-wrap select-all shadow-inner custom-scrollbar">
                  {selectedDoc.payload.text}
                </div>
                
                {/* Low Confidence Alert */}
                {selectedDoc.payload.confidence_score < 0.85 && (
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

    </div>
  );
}
