# UI skills for Shannon

These are open-source agent skills, copied in with their licenses. Use them for interface work. Product behavior stays in `agent-home/AGENTS.md`. Visual decisions stay in `DESIGN.md` at the repo root.

| Skill | Source | Commit | License | Use it for |
| --- | --- | --- | --- | --- |
| `impeccable` | https://github.com/pbakaus/impeccable | `b49177d` | Apache-2.0 | Audit, polish, and quieter passes. The detector catches common generated-UI mistakes. |
| `frontend-design` | https://github.com/anthropics/skills/tree/main/skills/frontend-design | `e4bb5d9` | Apache-2.0 | A new page or a visual redesign that must not look like a template. |
| `ui-ux-pro-max` | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill | `2de1134` | MIT | Searchable type, color, and UX rules while laying out a screen. |
| `web-design-guidelines` | https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines | `5a37a63` | MIT | A file-level check against the Vercel Web Interface Guidelines. |
| `accessibility` | https://github.com/addyosmani/web-quality-skills/tree/main/skills/accessibility | `afa8da9` | MIT | WCAG 2.2 review: contrast, names, keyboard, semantics. |
| `writing-guidelines` | https://github.com/vercel-labs/agent-skills/tree/main/skills/writing-guidelines | `5a37a63` | MIT | Landing, help, and empty-state prose. Shannon is a reading product; the words are the interface. |
| `build-for-good-ux` | https://github.com/alper-dev/build-for-good-ux-skill | see `SOURCE.md` | Apache-2.0 | Loading, empty, error, and success states on save, review, register, and chat. |

Each folder keeps the upstream `SKILL.md` and a `LICENSE` or `LICENSE.txt`. `SOURCE.md` records the repository, path, and commit when the license file lived outside the skill directory.
