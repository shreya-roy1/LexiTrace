"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";

interface SystemMetrics {
  fastapi: string;
  qdrant: string;
  redis: string;
  queue_depth: number;
}

interface RealtimeContextType {
  isConnected: boolean;
  pingTime: number;
  queuePendingCount: number;
  systemMetrics: SystemMetrics;
  sendWSAward: (payload: any) => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtime must be used within a RealtimeProvider");
  }
  return context;
};

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [pingTime, setPingTime] = useState(0);
  const [queuePendingCount, setQueuePendingCount] = useState(2); // Fallback mock defaults to 2
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    fastapi: "Disconnected",
    qdrant: "Disconnected",
    redis: "Offline",
    queue_depth: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(1000); // Start at 1s
  const pingStartRef = useRef<number>(0);
  const lastEventIdRef = useRef<number | null>(null);

  const connect = () => {
    try {
      const url = lastEventIdRef.current !== null
        ? `ws://localhost:8000/ws/system-events?last_event_id=${lastEventIdRef.current}`
        : "ws://localhost:8000/ws/system-events";
      
      console.log(`Connecting to WebSocket: ${url}`);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected successfully.");
        setIsConnected(true);
        reconnectDelayRef.current = 1000; // Reset reconnect delay

        // Start ping loop
        sendPing();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Track the last event ID
          if (data.event_id !== undefined) {
            lastEventIdRef.current = data.event_id;
          }
          
          if (data.event === "pong") {
            const latency = Date.now() - pingStartRef.current;
            setPingTime(latency);
            // 15-second heartbeat protocol
            setTimeout(sendPing, 15000);
            return;
          }

          if (data.event === "INIT" || data.event === "HEARTBEAT") {
            if (data.pending_count !== undefined) {
              setQueuePendingCount(data.pending_count);
            }
            if (data.metrics) {
              setSystemMetrics(data.metrics);
            }
          } else if (data.event === "QUEUE_UPDATED") {
            if (data.pending_count !== undefined) {
              setQueuePendingCount(data.pending_count);
            }
            // Trigger custom event so review list components can reload automatically
            window.dispatchEvent(new CustomEvent("lexitrace_queue_updated", { detail: data }));
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket connection closed.");
        setIsConnected(false);
        setSystemMetrics(prev => ({
          ...prev,
          fastapi: "Disconnected"
        }));
        scheduleReconnect();
      };

      ws.onerror = (err) => {
        console.error("WebSocket encountered error:", err);
        ws.close();
      };
    } catch (e) {
      console.error("Failed to establish WebSocket:", e);
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    const delay = reconnectDelayRef.current;
    console.log(`Reconnecting to WebSocket in ${delay}ms...`);
    setTimeout(() => {
      // Double the delay for exponential backoff, cap at 30 seconds
      reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30000);
      connect();
    }, delay);
  };

  const sendPing = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      pingStartRef.current = Date.now();
      wsRef.current.send("ping");
    }
  };

  const sendWSAward = (payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <RealtimeContext.Provider value={{
      isConnected,
      pingTime,
      queuePendingCount,
      systemMetrics,
      sendWSAward
    }}>
      {children}
    </RealtimeContext.Provider>
  );
};
