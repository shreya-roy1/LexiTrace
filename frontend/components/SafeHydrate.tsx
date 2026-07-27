"use client";

import React, { useState, useEffect } from "react";

interface SafeHydrateProps {
  children: React.ReactNode;
}

export default function SafeHydrate({ children }: SafeHydrateProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0F172A] text-[#94A3B8]">
        <div className="animate-pulse text-xs font-bold tracking-widest uppercase">
          Loading LexiTrace Workspace...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
