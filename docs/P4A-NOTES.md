# P4a notes

The running app follows the final P3 specification of 26 October 2026 and the contracts in `agent-home/`, copied from [shannon-agent-home-public](https://github.com/ixjtlgq67-glitch/shannon-agent-home-public) at `14facd688f571a80d4a01cc1d9897c5c120664ca`.

## Deviation, recorded rather than silent

The final spec configures reviewing roles from the reader's declared uses and keeps a standing Skeptic. It does not restore a fixed Economist / Practitioner / Historian roster.

This prototype seeds those three uses so a new register has somewhere to start:

- Practitioner and Economist run whenever triage recommends them.
- Historian is seeded with `requires_history`, so the Conductor skips it until the reader has accepted a judgment. That is the course prototype rule for Historian. The reader can turn the flag off, disable the use, or add another use. The Skeptic is not a declared use and never receives a taste profile.

The panel is still capped at four roles and eight proposals. Concept output is metadata. Quotation checks are deterministic code.
