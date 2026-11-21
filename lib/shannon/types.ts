import { z } from "zod";

/** Contracts copied from the Team Shannon agent home (`shannon_home/contracts.py`). */

const nonEmpty = z.string().min(1);

export const ParagraphSchema = z.strictObject({
  id: nonEmpty,
  text: nonEmpty,
});

export const FrozenSourceSchema = z.strictObject({
  user_id: nonEmpty,
  source_id: nonEmpty,
  source_version: nonEmpty,
  paragraphs: z.array(ParagraphSchema).min(1),
});

export const ProposalSchema = z.strictObject({
  proposal_id: nonEmpty,
  user_id: nonEmpty,
  source_id: nonEmpty,
  source_version: nonEmpty,
  quote: nonEmpty,
  paragraph_id: nonEmpty,
  judgment: nonEmpty,
  reasoning: nonEmpty,
  role_id: nonEmpty,
  use_id: z.string().min(1).nullable(),
  model_id: nonEmpty,
  prompt_version: nonEmpty,
  exploration: z.boolean(),
});

export const ProposalBatchSchema = z.strictObject({
  proposals: z.array(ProposalSchema),
  limitations: z.array(z.string()),
});

export const HumanDecisionSchema = z.strictObject({
  proposal_id: nonEmpty,
  user_id: nonEmpty,
  human_name: nonEmpty,
  action: z.enum(["accept", "reject"]),
  reason: z.string(),
  decided_at: nonEmpty,
});

export const TriageResultSchema = z.strictObject({
  readable: z.boolean(),
  recommendations: z.array(
    z.strictObject({
      use_id: nonEmpty,
      reason: z.string(),
    }),
  ),
  limitations: z.array(z.string()),
});

export const ConductorPlanSchema = z.strictObject({
  selected_use_ids: z.array(z.string()).max(3),
  include_skeptic: z.literal(true),
  include_concept: z.boolean(),
  planned_model_calls: z.number().int().min(1),
  retry_role_ids: z.array(z.string()),
  skipped_use_ids: z.array(z.string()),
  rationale: z.string(),
});

export const ConceptResultSchema = z.strictObject({
  concepts: z.array(
    z.strictObject({
      name: z.string(),
      use_ids: z.array(z.string()),
      paragraph_id: z.string(),
      reason: z.string(),
    }),
  ),
  limitations: z.array(z.string()),
});

export const GroundedTextSchema = z.strictObject({
  title: z.string(),
  statements: z.array(
    z.strictObject({
      text: z.string(),
      accepted_judgment_ids: z.array(z.string()).min(1),
    }),
  ),
  gaps: z.array(z.string()),
});

export type Paragraph = z.infer<typeof ParagraphSchema>;
export type FrozenSource = z.infer<typeof FrozenSourceSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
export type ProposalBatch = z.infer<typeof ProposalBatchSchema>;
export type HumanDecision = z.infer<typeof HumanDecisionSchema>;
export type TriageResult = z.infer<typeof TriageResultSchema>;
export type ConductorPlan = z.infer<typeof ConductorPlanSchema>;
export type ConceptResult = z.infer<typeof ConceptResultSchema>;
export type GroundedText = z.infer<typeof GroundedTextSchema>;

export type HistoryItem = {
  user_id: string;
  status: "accepted";
  id: string;
  quote: string;
  judgment: string;
  reasoning: string;
  decided_at: string;
  role_id: string;
  source_id: string;
};

export type DeclaredUse = {
  use_id: string;
  description: string;
  taste_profile: string;
  enabled: boolean;
  /** Prototype rule: this use is skipped until the reader has an accepted judgment. */
  requires_history: boolean;
};

export const DEFAULT_USES: DeclaredUse[] = [
  {
    use_id: "practitioner",
    description: "What a practitioner should do with this in work they already have.",
    taste_profile: "",
    enabled: true,
    requires_history: false,
  },
  {
    use_id: "economist",
    description: "Costs, incentives, and whether the claim should change a budget.",
    taste_profile: "",
    enabled: true,
    requires_history: false,
  },
  {
    use_id: "historian",
    description: "How this sits against judgments this reader has already accepted.",
    taste_profile: "",
    enabled: true,
    requires_history: true,
  },
];

export type RunStatus = "complete" | "incomplete";

export type CostStatus = "ok" | "error" | "timeout";

export type ProposalStatus = "pending" | "accepted" | "rejected" | "dropped";
