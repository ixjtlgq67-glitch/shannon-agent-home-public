# Shannon design guide

Shannon is a register of judgments a person has accepted, each one glued to a quotation. The reader is someone like a professor drafting a newsletter: they already have taste, they are short on time, and they will not trust a tool that looks like it is selling them software. The interface should feel like a desk, not a dashboard.

This guide wins when it conflicts with a generic skill default. The skills in `.cursor/skills/` are how you check the work. They do not choose the look.

## Visual direction

Calm, editorial, trustworthy.

The page is a reading surface. Paper, ink, a single seal color for the action that matters, and a lot of quiet. Quotations are set as quotations. Judgments are set as sentences a person would say out loud. Metadata (role, model, prompt version, locator) is present and small, because the product's promise is provenance, but it never competes with the sentence.

Do not ship a generic SaaS template: no gradient hero, no three identical feature cards with icons, no "Welcome to Shannon", no purple-on-white, no glassmorphism. A warm paper ground and a serif display face are allowed here because the subject is reading. They are not a license to add the rest of the generated-page kit: an all-caps eyebrow on every section, a middle dot between every meta string, the same radius on every box, or a shadow under every card.

Spend boldness in one place per screen. On the landing page that place is the headline and one specimen judgment. Inside the app that place is the quotation.

## Typography

Two jobs, two families, plus the UI face.

| Role | Face | Use |
| --- | --- | --- |
| Display | Fraunces | Page titles and the judgment sentence. This is the thing the reader decides. |
| Quotation | Newsreader | The frozen words, including the highlighted span. Never set a quotation in the UI sans. |
| UI | Outfit | Labels, navigation, buttons, tables, help text. |

Body text is at least 16px. Quotations are larger than the surrounding UI and have a line length under about 70 characters. Headings are sentence case, not title case, except proper names. Do not put one word of a headline in a second color.

Numbers that a reader compares (cost, counts, tokens) use tabular figures.

## Color

Name the inks. Do not invent a new accent per page.

| Token | Light | Job |
| --- | --- | --- |
| Paper | `#f3ecdf` | Page ground |
| Card | `#fbf7f0` | A sheet sitting on the desk |
| Ink | `#1e1a16` | Primary text |
| Ink soft | `#5e564c` | Secondary text. Must still clear 4.5:1 on paper and on card. |
| Line | `#d5cbbd` | Hairline, not a shadow |
| Seal | `#8f2d24` | The one action: sign up, accept, search |
| Moss | `#1f4d3a` | Accepted, complete. Always with the word. |
| Brass | `#8a6232` | Pending, incomplete, caution. Always with the word. |
| Mark | `#f0d9a6` | The highlighted quotation inside its paragraph |

Dark mode, when the reader's system asks for it, is the same desk with the lamp off: dark paper, light ink, the same seal. It is not a second brand. Check contrast again. Do not rely on the light-mode pairs.

Status is never color alone. Complete, incomplete, pending, accepted, and rejected are words. Color supports the word.

## Landing page

The first screen has one job: make a thoughtful person want an account before they scroll.

Above the fold, in this order:

1. The name.
2. A headline in the reader's own problem, not the product category. "The problem was never saving the link." is the right kind of sentence. "AI-powered bookmarking" is not.
3. Two sentences on what they will get: judgments with the exact words, and a register of only what they accept.
4. One seal-colored action, "Open a register", and a quieter way to see a judgment without signing up.
5. A specimen card that looks like the real review card: a pending judgment, a marked quotation, a role, a locator. Label it as a specimen so it is not mistaken for their register.

Anything below the fold explains the gate, the quotation check, and the cost. It does not repeat the hero in three equal cards.

## The first 60 seconds

The measure is time to the first accepted judgment, not time to a populated database.

After confirmation the reader should be one obvious action from a pending panel. On an empty register, "Load the Harbor Line notes" (or paste a passage) is the primary action, not a small alternate next to an empty form. The panel should come back as words they can accept or reject without learning a taxonomy.

Do not celebrate account creation. Confirm the email, then get out of the way. The success state is the judgment sitting in the register with its quotation, and a sentence that says so.

## Review panel

One card is one decision.

- The judgment is the title of the card, in Fraunces.
- The quotation is marked inside the frozen paragraph, in Newsreader, with the locator in words ("Paragraph p1") as well as the id.
- The role is a word: Skeptic, Practitioner, Economist, Historian, or the reader's own use. A color chip without the word is a failure.
- Provenance (source id, version, model, prompt version) is one quiet line, because the contract requires it.
- PENDING, COMPLETE, and INCOMPLETE are visible labels. Complete means every seated role answered. Incomplete means a role timed out or failed and the successful proposals were kept. Say which role, in text.
- Accept and Reject are real buttons, in the tab order, with visible focus. Reject's one-line reason is on the card, not behind a second dialog, so a keyboard user does not have to open anything to decline.
- A dropped quotation is a count and a reason. Do not show the bad text as if it were evidence.

## Empty states that teach

An empty screen says what is missing and the single next action. It does not apologize and it does not show a blank table.

| Screen | Empty means | The next action |
| --- | --- | --- |
| Save, no runs | Nothing has been frozen | Load the sample notes or paste a passage |
| Review, no pending cards | The reader has decided, or nothing survived the check | Say which, and link to the register |
| Register | Nothing has been accepted | Go save a source. Do not imply that rejections live here |
| Ask | No accepted judgments, or no question yet | Say which. Do not answer from the open web |
| Ledger | No calls yet | Say that saving a source is what writes the first row |
| Inbox | No confirmation note | Link back to sign-up |

Loading and failure are separate from empty. A panel that is still running says so. A page that failed says what to do next, in `role="alert"` or `role="status"`.

## Wording

Write the way the specimen headline is written.

- Second person. Name the object: judgment, quotation, register, panel, paragraph.
- Sentence case for titles and buttons. The verb is specific: "Accept into the register", "Save and run the panel", not "Continue" or "Submit".
- One idea per sentence. If a sentence needs a dash to stay standing, split it.
- Say what a rejection does: it stays in the audit log and does not enter the register.
- Do not say the model knows, believes, or verified the quotation. The server check did, or it did not.
- Do not use "AI-powered", "seamless", "unlock", or "welcome".
- Curly quotes around a quotation. An ellipsis character when a label trails off, not three periods.
- Errors include the recovery: "Paste the passage you want judged."

## Accessibility baseline

WCAG 2.2 AA is the floor.

- Text under 18px clears 4.5:1 against its own background, including ink-soft, badge text, the mark, and both color schemes. Large text and UI boundaries clear 3:1.
- Accept, Reject, Search, and Sign out are reachable by keyboard in an order that matches the page. Focus is visible and not covered by the header.
- Status is a word plus color. A green pill with no text is a bug.
- Every field has a visible label tied to the control. Placeholder text is not the label.
- The page has one `h1`. Landmarks exist (`header`, `nav`, `main`). A skip link is the first tab stop.
- Do not disable zoom. Honor `prefers-reduced-motion`.
- Touch targets are at least 44px on the actions a thumb will hit: the seal buttons and the navigation. WCAG's 24px minimum is not the bar for this product.
- After a decision, the confirmation is in the accessibility tree, not only in a color change.

## Which skill to use

| When | Skill |
| --- | --- |
| Before any UI edit | Read this file. Then `impeccable` for the mode of the surface: the landing page is Persuade, the app is Operate, help is Read. |
| Checking a built screen for generated-UI mistakes, contrast, or responsive breakage | `impeccable` audit. Use `quieter` if the screen got loud. Use `polish` only as the last pass. |
| Inventing a new page's look | `frontend-design`, then reject anything that would fit a different product with the nouns swapped. |
| Choosing type, spacing, or a component pattern | `ui-ux-pro-max`. Search one question at a time. This file overrides a palette that fights the desk. |
| Reviewing markup against interface rules | `web-design-guidelines`, file by file. |
| An accessibility pass, including a rendered page | `accessibility`. A perfect automated score is not conformance. |
| Landing, help, empty states, button labels | `writing-guidelines`, then apply the wording rules above. Sentence case stays. |
| Save, review, register, chat, ledger | `build-for-good-ux`. Name the loading, empty, error, and success state before calling the screen done. |
