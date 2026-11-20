# Dated decision log

## 2026-10-26 — Final v4 specification is the baseline
Evidence: `docs/P3-Team-Shannon-v4.pdf`, supplied as the final assignment by Qi Liu. Its three prose pages and fourth diagram page supersede the older private starter. Product roles are user-configured; the old fixed role roster is not copied.

## 2026-10-26 — New public agent home
Qi requested a new public repository so everyone can read it. The public home contains this assignment, reusable instructions, contracts, synthetic tests and project records. Private article text, user histories, credentials and production logs remain outside GitHub. The previous private repository is retained separately.

## 2026-10-26 — Implementation choices for this reference home
These are implementation choices, not additional claims approved in the assignment: Python SDK adapter; one definition per named role; separate build and product Conductors; structured output models; synthetic offline demonstration. The SDK entry point has no mutation tools and does not deploy the product. Build agents return artifacts/patches for an authorized development host to apply.

## 2026-10-26 — Resolve the prototype panel bound conservatively
The final spec says user-defined roles plus Skeptic, and at most eight proposals from four roles. This implementation counts Skeptic among those four: up to three declared-use roles plus Skeptic, two proposals each. Concept is a separate metadata call. Confirm this interpretation with the team if expanding scope.

## 2026-10-26 — Bootstrap reviewer routing
Qi confirmed Guillermo's GitHub username as `br-collab` and asked to add Sneha and Carlos later. CODEOWNERS includes Guillermo on Signal/platform paths, pending his acceptance of the contributor invitation. Surface and Output temporarily route to the repository custodian; their pod usernames and the designated database schema owner are pending confirmation. Main protection permits administrator bypass during this bootstrap period. No unverified teammate account is granted access.
