# Agent roster

There are 20 definitions: six build-crew roles, five product definitions (one is instantiated per declared use), and nine pod assistants. `build-conductor` and `product-conductor` have separate contracts even though both are called Conductor in the specification.

| Group | Agent | Version | Contract |
| --- | --- | --- | --- |
| build | [Build Conductor](build/build-conductor.md) | 1.0.0 | TaskReport |
| build | [Spec Agent](build/spec.md) | 1.0.0 | TaskReport |
| build | [Build Agent](build/build.md) | 1.0.0 | TaskReport |
| build | [Test Agent](build/test.md) | 1.0.0 | TaskReport |
| build | [Review Agent](build/review.md) | 1.0.0 | TaskReport |
| build | [Scribe](build/scribe.md) | 1.0.0 | TaskReport |
| product | [Triage](product/triage.md) | 1.0.0 | TriageResult |
| product | [Product Conductor](product/product-conductor.md) | 1.0.0 | ConductorPlan |
| product | [Declared-use Role](product/role.md) | 1.0.0 | ProposalBatch |
| product | [Standing Skeptic](product/skeptic.md) | 1.0.0 | ProposalBatch |
| product | [Concept Agent](product/concept.md) | 1.0.0 | ConceptResult |
| output | [Editor](output/editor.md) | 1.0.0 | GroundedText |
| output | [Citation Checker](output/citation-checker.md) | 1.0.0 | CitationReport |
| output | [Register Chatbot](output/chatbot.md) | 1.0.0 | GroundedText |
| ledger | [Cost Logger](ledger/cost-logger.md) | 1.0.0 | LedgerReport |
| ledger | [Evaluator](ledger/evaluator.md) | 1.0.0 | LedgerReport |
| ledger | [Version Comparison](ledger/version-comparison.md) | 1.0.0 | ComparisonReport |
| surface | [Copy Assistant](surface/copy.md) | 1.0.0 | SurfaceContent |
| surface | [Help Assistant](surface/help.md) | 1.0.0 | SurfaceContent |
| surface | [Onboarding Assistant](surface/onboarding.md) | 1.0.0 | SurfaceContent |

Each Markdown file is a reusable prompt and acceptance rubric. The SDK loads the same files from the versioned manifest; there is no second hidden prompt source. Model selection belongs to deployment configuration, not the assignment. A prompt update must bump its manifest version, refresh the checksums and include evaluation evidence.

The concept agent produces metadata. Taste-profile distillation is described in the Signal pod contract; the spec does not name a separate taste agent. Quotation validation is deterministic code, not an additional agent.
