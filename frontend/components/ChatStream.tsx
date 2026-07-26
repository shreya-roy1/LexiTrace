import React from "react";
import { 
  Sparkles, 
  AlertTriangle, 
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

interface ChatStreamProps {
  messages: Message[];
  agentStatus: string | null;
  isStreamPaused: boolean;
  handleRetryStream: () => void;
  handleCitationClick: (docIndex: number, msgDocs?: DocumentInfo[]) => void;
}

export const ChatStream: React.FC<ChatStreamProps> = ({
  messages,
  agentStatus,
  isStreamPaused,
  handleRetryStream,
  handleCitationClick,
}) => {
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
              <Sparkles className="w-4 h-4 text-interactive-accent" />
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
              {msg.timestamp instanceof Date ? msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
    </div>
  );
};

interface ThinkingIndicatorProps {
  loading: boolean;
  activeNode: string | null;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ loading, activeNode }) => {
  if (!loading || !activeNode) return null;

  const steps = [
    { id: "retrieve", label: "Searching enterprise documents...", icon: Search },
    { id: "grading", label: "Reranking top context matches...", icon: Zap },
    { id: "verifying", label: "Verifying citations via NLI...", icon: ShieldCheck },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4 bg-bg-canvas px-4 py-2.5 rounded-lg border border-border-subtle text-xs animate-[fadeIn_0.3s_ease-out] shadow-sm">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        const isCurrent = activeNode === step.id;
        const isCompleted = 
          (activeNode === "grading" && step.id === "retrieve") ||
          (activeNode === "generating" && (step.id === "retrieve" || step.id === "grading")) ||
          (activeNode === "verifying" && (step.id === "retrieve" || step.id === "grading" || step.id === "generating"));

        return (
          <React.Fragment key={step.id}>
            {idx > 0 && <div className="hidden sm:block h-px bg-border-subtle w-6"></div>}
            <div className="flex items-center gap-1.5">
              <Icon className={`w-3.5 h-3.5 ${
                isCurrent 
                  ? "text-interactive-accent animate-pulse" 
                  : isCompleted 
                    ? "text-emerald-500" 
                    : "text-text-secondary"
              }`} />
              <span className={`italic transition-all duration-300 ${
                isCurrent 
                  ? "font-bold text-text-primary" 
                  : "text-text-secondary"
              }`}>
                {step.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
