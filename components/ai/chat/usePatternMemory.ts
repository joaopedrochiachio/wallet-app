"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadPatternMemory, savePatternMemory } from "@/lib/services/aiChatService";
import type { PatternMemory } from "@/lib/services/cofiPatterns";

/**
 * Memória dos padrões (o que a pessoa respondeu sobre cada um), compartilhada
 * entre a auditoria da tela e o chat. Salva na conta a cada mudança.
 */
export function usePatternMemory(userId?: string) {
  const [memory, setMemory] = useState<PatternMemory>({});
  const ref = useRef<PatternMemory>({});

  useEffect(() => {
    let alive = true;
    loadPatternMemory(userId).then((m) => {
      if (!alive) return;
      ref.current = m;
      setMemory(m);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const update = useCallback(
    (change: (current: PatternMemory) => PatternMemory): PatternMemory => {
      const next = change(ref.current);
      ref.current = next;
      setMemory(next);
      void savePatternMemory(next, userId);
      // Devolve a memória nova para quem precisa dela antes do próximo render
      return next;
    },
    [userId]
  );

  return [memory, update] as const;
}
