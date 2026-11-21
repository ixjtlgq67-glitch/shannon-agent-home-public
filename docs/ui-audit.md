# Shannon UI audit

Audited the running prototype on 20 November 2026. No fixes were applied.

Checked every route in a signed-in browser (Ada Reader), in light and dark, and the landing page and library at 390px wide:

| Page | Screenshot |
| --- | --- |
| Landing | [01-landing.png](ui-audit/screenshots/01-landing.png) |
| Sign up | [02-signup.png](ui-audit/screenshots/02-signup.png) |
| Sign in | [03-login.png](ui-audit/screenshots/03-login.png) |
| Local inbox | [04-inbox.png](ui-audit/screenshots/04-inbox.png) |
| Help | [05-help.png](ui-audit/screenshots/05-help.png) |
| Library | [06-library.png](ui-audit/screenshots/06-library.png) |
| Review | [07-review.png](ui-audit/screenshots/07-review.png) |
| Register search | [08-register.png](ui-audit/screenshots/08-register.png) |
| Ask | [09-chat.png](ui-audit/screenshots/09-chat.png) |
| Ledger | [10-ledger.png](ui-audit/screenshots/10-ledger.png) |
| Uses | [11-uses.png](ui-audit/screenshots/11-uses.png) |
| Landing, dark | [12-landing-dark.png](ui-audit/screenshots/12-landing-dark.png) |
| Library, dark | [13-library-dark.png](ui-audit/screenshots/13-library-dark.png) |
| Landing, 390px | [14-landing-mobile.png](ui-audit/screenshots/14-landing-mobile.png) |
| Library, 390px | [15-library-mobile.png](ui-audit/screenshots/15-library-mobile.png) |

Tools, used as their skills specify:

- **impeccable** `detect` on the rendered landing, sign-up, sign-in, help, and inbox pages (1280px), plus the landing page at 390px. Authenticated routes were opened in the same browser session and checked with axe, because the detector loads a URL without the session cookie.
- **accessibility** (Addy Osmani / WCAG 2.2): axe-core 4.14 on every screenshot above, including dark mode. Contrast of the named tokens was also calculated. Axe reported no contrast failures.
- **web-design-guidelines**: the bundled rules in `.cursor/skills/web-design-guidelines/references/command.md`, applied to `app/` and `components/`.

`DESIGN.md` overrides two guideline defaults. The paper ground is intentional, so impeccable's `cream-palette` warning is not a defect. Button labels stay in sentence case, not Title Case.

## Impeccable health score

| # | Dimension | Score | Key finding |
| --- | --- | --- | --- |
| 1 | Accessibility | 3 | Contrast passes. No skip link, and four pages have no `main`. |
| 2 | Performance | 3 | No layout animation or oversized images. Favicons are small. |
| 3 | Theming | 3 | Tokens cover light and dark. Axe was clean in both. |
| 4 | Responsive | 3 | Pages wrap. Nav and Sign out are under the 44px target. |
| 5 | Implementation integrity | 2 | One editorial system, repeated as an all-caps kicker on every screen. |
| **Total** | | **14/20** | **Good** |

## P0

None. A reader can land, sign up, save, review, accept, search, ask, and read help with the keyboard on the primary actions. Seal buttons are `#fff8f2` on `#8f2d24` (7.8:1).

## P1

1. **No skip link.** `components/shell.tsx`, `app/page.tsx`, `components/auth-frame.tsx`, `app/help/page.tsx`, `app/inbox/page.tsx`. Add "Skip to content" as the first tab stop, pointing at `main`.
2. **Sign-up, sign-in, help, and the inbox have no main landmark.** axe `landmark-one-main` on those four routes. Wrap each page in `<main>`.
3. **Nav and Sign out are about 32px tall.** `components/shell.tsx:34` and `:42`. On a phone the six links sit in a horizontal scroller. Give them `min-h-11` so the hit area is at least 44px.

## P2

1. **A tracked all-caps kicker sits above every title.** `app/page.tsx:27`, `app/help/page.tsx:9`, and the same pattern on each app page. impeccable flags it as a hero eyebrow. Drop the kicker, or set it in sentence case in the normal UI face.
2. **Help lines run about 110 characters.** `app/help/page.tsx:5` is `max-w-3xl`. Set the prose column to `max-w-prose`.
3. **Placeholder text is 3.4:1.** Sign-up placeholder "Qi Liu" is `#8d867d` on `#fbf7f0`. The visible label passes. Darken placeholders to ink-soft (`#5e564c`, 6.8:1).
4. **Smooth scrolling ignores reduced motion.** `app/globals.css:52`. Wrap `scroll-behavior: smooth` in `@media (prefers-reduced-motion: no-preference)`.
5. **The demo banner is outside every landmark.** `components/shell.tsx:48`. axe `region` on every signed-in page. Move that sentence into the header.
6. **Library search floats beside the heading, and Search is shorter than the field.** `app/app/page.tsx` search form. Stack it under "Library" and use the same 44px control height as the inputs.
7. **Default buttons are 40px, not 44px.** `components/ui/button.tsx:16` `h-10`. Change the default size to `h-11`.
8. **Status chips are 11px and all caps.** `components/ui/badge.tsx:5`. The word is doing the work. Use `text-xs` and sentence case.
9. **Email fields allow spellcheck.** `app/login/page.tsx:26` and the matching sign-up field. Add `spellCheck={false}`.
10. **An empty Ask thread only says "No questions yet."** `app/app/chat/page.tsx:31`. Offer one example question drawn from the register.

## Not defects

- Paper `#f3ecdf` is the desk in `DESIGN.md`. Do not "fix" the cream-palette warning by switching to white.
- Sentence-case buttons ("Accept into the register", "Save and run the panel") disagree with the Vercel Title Case rule on purpose.
- One-word line endings on the landing page ("them.", "pending.") are advisory stragglers, not broken layout.
- Pending, complete, incomplete, and accepted are words plus color. Review quotations are marked inside the paragraph. Those should stay.

## What is already working

Keyboard accept and reject are real buttons in tab order, with a visible seal focus ring. Labels are tied to fields. Headings do not skip levels. Light and dark text pairs for ink, ink-soft, brass, seal, moss, and the quotation mark all clear 4.5:1. The landing headline and a specimen judgment are in the first screen.

Recommended later, not run: `/impeccable quieter` for the kickers, `/impeccable adapt` for the 44px targets, then `/impeccable polish`.
