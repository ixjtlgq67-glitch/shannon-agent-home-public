"""Shared contracts; JSON Schemas are generated from these models."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)

class Artifact(StrictModel):
    path: str
    content: str
    purpose: str

class Finding(StrictModel):
    location: str
    severity: Literal['info', 'low', 'medium', 'high']
    evidence: str
    recommendation: str

class TaskReport(StrictModel):
    task_id: str
    status: Literal['proposed', 'blocked', 'complete']
    summary: str
    assigned_worker: str | None
    artifacts: list[Artifact]
    acceptance_criteria: list[str]
    findings: list[Finding]
    tests_actually_run: list[str]
    open_questions: list[str]
    next_action: str

class UseRecommendation(StrictModel):
    use_id: str
    reason: str

class TriageResult(StrictModel):
    readable: bool
    recommendations: list[UseRecommendation]
    limitations: list[str]

class ConductorPlan(StrictModel):
    selected_use_ids: list[str] = Field(max_length=3)
    include_skeptic: Literal[True]
    include_concept: bool
    planned_model_calls: int = Field(ge=1)
    retry_role_ids: list[str]
    skipped_use_ids: list[str]
    rationale: str

class Proposal(StrictModel):
    proposal_id: str = Field(min_length=1)
    user_id: str = Field(min_length=1)
    source_id: str = Field(min_length=1)
    source_version: str = Field(min_length=1)
    quote: str = Field(min_length=1)
    paragraph_id: str = Field(min_length=1)
    judgment: str = Field(min_length=1)
    reasoning: str = Field(min_length=1)
    role_id: str = Field(min_length=1)
    use_id: str | None
    model_id: str = Field(min_length=1)
    prompt_version: str = Field(min_length=1)
    exploration: bool

class ProposalBatch(StrictModel):
    proposals: list[Proposal] = Field(max_length=2)
    limitations: list[str]

class Concept(StrictModel):
    name: str
    use_ids: list[str]
    paragraph_id: str
    reason: str

class ConceptResult(StrictModel):
    concepts: list[Concept]
    limitations: list[str]

class GroundedStatement(StrictModel):
    text: str
    accepted_judgment_ids: list[str] = Field(min_length=1)

class GroundedText(StrictModel):
    title: str
    statements: list[GroundedStatement]
    gaps: list[str]

class CitationCheck(StrictModel):
    statement_location: str
    accepted_judgment_ids: list[str]
    status: Literal['supported', 'unsupported', 'overstated', 'unverified']
    evidence: str

class CitationReport(StrictModel):
    checks: list[CitationCheck]
    findings: list[Finding]

class Metric(StrictModel):
    name: str
    value: float | None
    numerator: float | None
    denominator: float | None
    explanation: str

class LedgerReport(StrictModel):
    metrics: list[Metric]
    included_event_ids: list[str]
    unknown_event_ids: list[str]
    limitations: list[str]

class ComparisonReport(StrictModel):
    baseline_version: str
    candidate_version: str
    matched_item_ids: list[str]
    metrics: list[Metric]
    recommendation: str
    limitations: list[str]

class ContentBlock(StrictModel):
    screen_or_topic: str
    text: str
    next_action: str
    feature_status: Literal['implemented', 'planned', 'unverified']

class SurfaceContent(StrictModel):
    blocks: list[ContentBlock]
    open_questions: list[str]

class Paragraph(StrictModel):
    id: str = Field(min_length=1)
    text: str = Field(min_length=1)

class FrozenSource(StrictModel):
    user_id: str = Field(min_length=1)
    source_id: str = Field(min_length=1)
    source_version: str = Field(min_length=1)
    paragraphs: list[Paragraph] = Field(min_length=1)

class HumanDecision(StrictModel):
    proposal_id: str
    user_id: str
    human_name: str = Field(min_length=1)
    action: Literal['accept', 'reject']
    reason: str
    decided_at: str = Field(min_length=1)

OUTPUT_MODELS = {m.__name__: m for m in [TaskReport, TriageResult, ConductorPlan,
    ProposalBatch, ConceptResult, GroundedText, CitationReport, LedgerReport,
    ComparisonReport, SurfaceContent]}
SCHEMA_MODELS = dict(OUTPUT_MODELS, Proposal=Proposal, FrozenSource=FrozenSource,
                     HumanDecision=HumanDecision)
