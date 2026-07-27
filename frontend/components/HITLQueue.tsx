import React from "react";
import { ClipboardCheck } from "lucide-react";

interface IngestDocument {
  id: string;
  text: string;
  source_pdf: string;
  page_number: number;
  confidence_score: number;
}

interface HITLQueueProps {
  queue: IngestDocument[];
  activeItemId: string | null;
  onSelectItem: (item: IngestDocument) => void;
}

export const HITLQueue: React.FC<HITLQueueProps> = ({
  queue,
  activeItemId,
  onSelectItem,
}) => {
  return (
    <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
      {queue.map((item) => {
        const isActive = item.id === activeItemId;
        
        // High confidence green, low confidence red
        const confidenceColor = 
          item.confidence_score >= 0.85
            ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
            : item.confidence_score >= 0.70
              ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
              : "text-rose-500 bg-rose-500/10 border-rose-500/20";

        return (
          <button
            key={item.id}
            onClick={() => onSelectItem(item)}
            className={`w-full text-left p-3.5 rounded-xl border transition-all duration-300 flex flex-col gap-2 cursor-pointer shadow-xs hover:border-interactive-accent/50 ${
              isActive
                ? "bg-bg-surface border-interactive-accent/70 shadow-md ring-2 ring-interactive-accent/20"
                : "bg-bg-sidebar/40 border-border-subtle hover:bg-bg-surface"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5 min-w-0">
                <ClipboardCheck className={`w-3.5 h-3.5 ${isActive ? "text-interactive-accent" : "text-text-secondary"}`} />
                <span className="text-xs font-bold text-text-primary truncate max-w-[120px]">
                  {item.source_pdf}
                </span>
              </div>
              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${confidenceColor}`}>
                {(item.confidence_score * 100).toFixed(0)}% OCR
              </span>
            </div>
            
            <p className="text-[10px] text-text-secondary line-clamp-2 leading-relaxed">
              {item.text}
            </p>
            
            <div className="text-[9px] font-mono text-text-secondary flex justify-between items-center border-t border-border-subtle/50 pt-2 mt-1">
              <span>Page {item.page_number}</span>
              <span className="font-semibold text-text-primary">ID: {item.id}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
