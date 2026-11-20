# Implementation scope and integration

This repository implements the shared agent home: all 20 reusable prompts, their SDK definitions, typed output contracts, a deterministic quotation/locator validator, role planning, deduplication, metrics, and a synthetic offline demonstration. Individual agents can be invoked through the official OpenAI Agents SDK after server-side configuration. Build workers return proposed artifacts; the supplied runner cannot edit files or execute shell commands.

The full Shannon product still needs its authenticated web UI, Supabase schema/RLS/private Storage, frozen-source capture, durable proposal/decision/audit storage, retrieval, server job orchestration, provider usage billing, editable taste profiles and Replit deployment. Do not present the offline demonstration as a working multi-user service.

## Runtime sequence
Save and freeze paragraphs -> Triage recommendations -> deterministic Conductor budget/role selection -> selected roles in parallel (Skeptic included) and optional Concept metadata -> exact server validation -> deduplicate -> persist pending -> named authenticated human accept/reject -> accepted register or rejection audit.

The Product Conductor prompt can propose a plan; server code must enforce it. `select_panel` reserves the Skeptic and caps reviewing roles at four. `validate_batch` checks source/version, role, user scope, evidence and two-per-role. `deduplicate` removes exact duplicates only within a role, preserving different uses and dissent. Missing/failed requested roles must make the stored run incomplete even when some valid proposals are available.

## Production boundaries to implement
- Obtain identity only from verified Supabase Auth on the server; never trust a client-supplied user ID. Enforce RLS on every product table and private object.
- Freeze source versions and stable paragraph IDs at save time; pasted text is the fallback for extraction failures.
- Reserve call/token/currency budgets atomically before parallel dispatch. Include routing, orchestration, concepts and retries. Disable implicit retries or meter each attempt. Persist progress and retry only failed roles. The CLI has one-turn/output-token caps but is not a hard per-item dollar-budget implementation.
- On every model call store model, prompt version, status, token usage, latency and price-version estimate. Missing usage on an error remains unknown. Never log source text.
- Gate register writes behind a server transaction consuming a pending proposal and a verified human decision. Repeated requests must be idempotent; accepted decisions are immutable. The pure demonstration transition is not an authentication or database layer.
- Distill readable per-use taste from the user's accepts/rejects; let the user inspect/edit. Mark one in five role proposals as exploration; exclude Skeptic from taste. Measure diversity, not just acceptance.
- Editor and Chatbot receive only authorized accepted-register retrieval; any factual output maps to accepted IDs. Citation Checker audits drafts; the deterministic server validator remains authoritative.
- Replit Agent builds/tests; Replit Deployments hosts; OpenAI Agents SDK runs server-side agents; Supabase stores product memory. Host changes require a decision record.

## SDK usage
The adapter follows the [official SDK quickstart](https://developers.openai.com/api/docs/guides/agents/quickstart?lang=python). Model ID is explicit configuration. Tracing is disabled and provider automatic retries are disabled in the reference runner. The runner prints model output and usage to your private terminal; do not redirect private output into public repository files. No live model calls are made by CI.
