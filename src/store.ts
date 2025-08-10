import { useEffect, useState } from "react";
import type { Instruction, UserProgress, VerificationResult, DbInstructionRow } from "./types";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";
import { toInstruction } from "./types";

/**
 * Convert raw Supabase rows to Instruction objects.
 */
function fromSupabase(rows: DbInstructionRow[] | null): Instruction[] {
  if (!rows) return [];
  return rows.map(toInstruction);
}

/**
 * Hook to hold and manage global app state.
 * Includes a manual refresh mechanism (triggerRefresh) for when realtime is disabled.
 */
export function useAppStore() {
  const { user } = useSession();

  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [userProgress, setUserProgress] = useState<Record<string, UserProgress>>({});

  // Load instructions from Supabase
  async function load() {
    const or = user?.id
      ? `is_public.eq.true,created_by.eq.${user.id}`
      : `is_public.eq.true`;

    const { data, error } = await supabase
      .from("instructions")
      .select("*")
      .or(or)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch instructions error:", error);
      return;
    }

    setInstructions(fromSupabase(data as DbInstructionRow[]));
  }

  // Initial load + reload when user changes
  useEffect(() => {
    load();
  }, [user?.id]);

  // Listen for manual refresh events from triggerRefresh()
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("aiyes:refresh", handler);
    return () => window.removeEventListener("aiyes:refresh", handler);
  }, []);

  const updateProgress = (
    instructionId: string,
    updater: (prev: UserProgress | undefined) => UserProgress
  ) => {
    setUserProgress((prev) => ({
      ...prev,
      [instructionId]: updater(prev[instructionId]),
    }));
  };

  const addVerification = (instructionId: string, result: VerificationResult) => {
    updateProgress(instructionId, (prev) => ({
      userId: user?.id ?? "anon",
      instructionId,
      currentStep: prev?.currentStep ?? 0,
      completedSteps: prev?.completedSteps ?? [],
      verificationResults: [...(prev?.verificationResults ?? []), result],
    }));
  };

  return {
    instructions,
    setInstructions,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    userProgress,
    updateProgress,
    addVerification,
  };
}

/**
 * Call this to trigger a reload of instructions from anywhere.
 * Example: after creating a new instruction.
 */
export function triggerRefresh() {
  window.dispatchEvent(new Event("aiyes:refresh"));
}
