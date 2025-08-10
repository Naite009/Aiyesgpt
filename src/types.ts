/**
 * Core domain types for Aiyes.
 * Keep these synced with your Supabase table schemas.
 */

export interface Instruction {
  id: string;
  title: string;
  content: string;          // markdown or plain text steps
  category: string;
  tags: string[];
  isPublic: boolean;        // maps from DB column is_public
  createdBy: string;        // maps from DB column created_by
  createdAt: string;        // ISO timestamp
  fileUrl?: string | null;  // optional attachment URL
  fileName?: string | null; // optional attachment name
}

/** A parsed, in-memory step (derived from Instruction.content). */
export interface Step {
  id: string;               // local ID (e.g., `${instructionId}:${index}`)
  content: string;          // the step text
  completed: boolean;
  verified: boolean;
  confidence?: number;      // last verification confidence
  verificationData?: any;   // model/raw payload if you need it later
}

/** Result returned by the verification function. */
export interface VerificationResult {
  stepId?: string;          // optional link to a Step id
  confidence: number;       // 0..1
  feedback: string;         // brief model feedback
  timestamp?: string;       // ISO time (client-side when captured)
  imageData?: string;       // optional data URL for the frame used
}

/**
 * Per-user progress for one instruction.
 * This is the client-side shape we keep in memory (not the DB row).
 */
export interface UserProgress {
  userId: string;           // supabase auth user id or "anon"
  instructionId: string;    // Instruction.id
  currentStep: number;      // zero-based index
  completedSteps: number[]; // indices of completed steps
  verificationResults: VerificationResult[];
}

/** Optional: shape used when seeding from Supabase rows (raw DB shape). */
export interface DbInstructionRow {
  id: string;
  title: string;
  content: string;
  is_public: boolean;
  created_by: string | null;
  category: string | null;
  tags: string[] | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string;       // timestamptz
}

/** Type guard to convert DB row -> Instruction safely. */
export function toInstruction(row: DbInstructionRow): Instruction {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category ?? "General",
    tags: row.tags ?? [],
    isPublic: row.is_public,
    createdBy: row.created_by ?? "",
    createdAt: row.created_at,
    fileUrl: row.file_url,
    fileName: row.file_name,
  };
}
