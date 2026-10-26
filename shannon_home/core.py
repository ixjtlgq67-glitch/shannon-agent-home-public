"""Pure reference checks. Authentication and durable transactions belong to the server."""
from collections import Counter
from .contracts import FrozenSource, Proposal, ProposalBatch, HumanDecision


def select_panel(recommended: list[str], declared: list[str], remaining_calls: int) -> list[str]:
    """Calls here cover reviewing roles only; caller reserves triage/concept/orchestration."""
    if remaining_calls < 1:
        raise ValueError('No budget for required Skeptic')
    unique = list(dict.fromkeys(recommended))
    if any(u not in declared for u in unique):
        raise ValueError('Undeclared use')
    return ['skeptic'] + ['use:' + u for u in unique[:min(3, remaining_calls - 1)]]


def validate_batch(batch: ProposalBatch, source: FrozenSource, *, expected_role: str,
                   expected_model: str, expected_prompt_version: str,
                   declared_uses: list[str]) -> list[Proposal]:
    """Reject a malformed batch atomically; exact quotation checks use no model."""
    ids = [p.id for p in source.paragraphs]
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate paragraph locator')
    paragraphs = {p.id: p.text for p in source.paragraphs}
    if len(batch.proposals) > 2:
        raise ValueError('More than two proposals for role')
    seen = set()
    for p in batch.proposals:
        if p.proposal_id in seen:
            raise ValueError('Duplicate proposal ID')
        seen.add(p.proposal_id)
        if (p.user_id, p.source_id, p.source_version) != (source.user_id, source.source_id, source.source_version):
            raise ValueError('Wrong user, source or frozen version')
        if (p.role_id, p.model_id, p.prompt_version) != (expected_role, expected_model, expected_prompt_version):
            raise ValueError('Wrong runtime provenance')
        if not p.quote.strip() or p.paragraph_id not in paragraphs or p.quote not in paragraphs[p.paragraph_id]:
            raise ValueError('Quote does not match its frozen paragraph')
        if not p.judgment.strip() or not p.reasoning.strip():
            raise ValueError('Missing judgment or reasoning')
        if p.role_id == 'skeptic':
            if p.use_id is not None or p.exploration:
                raise ValueError('Skeptic has no learned-use profile or exploration mode')
        elif p.use_id not in declared_uses or p.role_id != 'use:' + p.use_id:
            raise ValueError('Role does not match a declared use')
    return batch.proposals


def deduplicate(proposals: list[Proposal]) -> list[Proposal]:
    """Do not collapse differing judgments, use contexts or Skeptic dissent."""
    result, seen, ids = [], set(), set()
    for p in proposals:
        if p.proposal_id in ids:
            raise ValueError('Duplicate proposal ID across batches')
        ids.add(p.proposal_id)
        key = (p.user_id, p.source_id, p.source_version, p.role_id, p.use_id,
               p.paragraph_id, p.quote, ' '.join(p.judgment.split()))
        if key not in seen:
            result.append(p)
            seen.add(key)
    return result


def panel_status(expected_roles: list[str], successful_roles: list[str]) -> str:
    return 'complete' if set(expected_roles) <= set(successful_roles) else 'incomplete'


def apply_demo_decision(proposal: Proposal, decision: HumanDecision, *,
                        authenticated_user_id: str, current_status: str = 'pending') -> dict:
    """Pure transition only. Caller identity MUST come from real auth in production."""
    if not authenticated_user_id or proposal.user_id != authenticated_user_id or decision.user_id != authenticated_user_id:
        raise ValueError('Unauthorized user')
    if decision.proposal_id != proposal.proposal_id:
        raise ValueError('Wrong proposal')
    if current_status != 'pending':
        raise ValueError('Decision already finalized')
    if not decision.human_name.strip():
        raise ValueError('Named human required')
    status = 'accepted' if decision.action == 'accept' else 'rejected'
    return {'status': status, 'audit': decision.model_dump(),
            'register_entry': proposal.model_dump() if status == 'accepted' else None}


def metrics(*, accepted: int, reviewed: int, event_costs: list[float | None]) -> dict:
    if accepted < 0 or reviewed < accepted or any(c is not None and c < 0 for c in event_costs):
        raise ValueError('Invalid counts or costs')
    total = None if any(c is None for c in event_costs) else sum(event_costs)
    return {'acceptance_rate': accepted / reviewed if reviewed else None,
            'total_model_cost_usd': total,
            'cost_per_accepted_judgment_usd': total / accepted if accepted and total is not None else None}
