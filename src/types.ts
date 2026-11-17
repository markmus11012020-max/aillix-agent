export type StepId =
  | "intake"
  | "user"
  | "options"
  | "compare"
  | "value"
  | "ai_mcp"
  | "mvp"
  | "architecture"
  | "plan"
  | "card"
  | "red_team";

export type AgentRole = "captain" | "developer" | "reviewer" | "orchestrator";

export interface StepDefinition {
  id: StepId;
  number: number;
  title: string;
  owner: AgentRole;
  artifact: string;
  kaitenColumn: string;
  timeLimitMin: number;
  gate: string[];
}

export interface BoardCardInput {
  title: string;
  description?: string;
  column: string;
  lane?: string;
  externalId?: string;
  ownerId?: number;
  responsibleId?: number;
  dueDate?: string;
}

export interface BoardCard {
  id: string;
  title: string;
  description?: string;
  column: string;
  lane?: string;
  externalId?: string;
  url?: string;
}

export interface Board {
  readonly kind: "kaiten" | "local";
  health(): Promise<{ ok: boolean; message: string }>;
  getColumns(): Promise<Array<{ id: string; title: string }>>;
  listCards(): Promise<BoardCard[]>;
  createCard(input: BoardCardInput): Promise<BoardCard>;
  updateCard(id: string, input: Partial<BoardCardInput>): Promise<BoardCard>;
  moveCard(id: string, column: string, lane?: string): Promise<BoardCard>;
  addComment(id: string, text: string): Promise<void>;
  sync(): Promise<{ ok: boolean; message: string }>;
}

export interface Question {
  id: string;
  step: StepId;
  text: string;
  why: string;
  options?: string[];
  recommended?: string;
  blocking: boolean;
  status: "open" | "answered" | "closed";
  answer?: string;
  createdAt: string;
  answeredAt?: string;
}

export interface Recommendation {
  id: string;
  step: StepId;
  text: string;
  rationale: string;
  confidence: "low" | "medium" | "high";
  changeCondition: string;
  status: "proposed" | "accepted" | "rejected" | "deferred";
  decision?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface Decision {
  id: string;
  step: StepId;
  text: string;
  reason: string;
  who: string;
  createdAt: string;
}

export interface Dashboard {
  step: StepId;
  stepNumber: number;
  stepTitle: string;
  owner: AgentRole;
  status: "ready" | "blocked" | "done";
  progress: number;
  startedAt: string;
  elapsedMin: number;
  remainingMin: number;
  nextStop: string;
  nextStopLabel: string;
  openQuestions: number;
  blockingQuestions: number;
  proposedRecommendations: number;
  blockers: string[];
  nextAction: string;
}
