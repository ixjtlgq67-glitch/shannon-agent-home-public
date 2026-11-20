# Shannon

Shannon is a register of human-accepted judgments. A signed-in reader saves a URL or pastes a passage. The source is frozen with paragraph locators. A small panel proposes judgments that quote the source exactly. Server code, not a model, checks each quotation. The reader accepts or rejects. Only an acceptance enters the register, and it is still there after sign-out.

This is the Part 4a prototype for Columbia TMGT PS5200, Team Shannon (Guillermo Ravelo, Sneha Sudharsan, Carlos del Rosario, Qi Liu). The final specification is the 26 October 2026 P3 assignment.

The GitHub account for this work is [ixjtlgq67-glitch](https://github.com/ixjtlgq67-glitch). The specification lives in [shannon-agent-home-public](https://github.com/ixjtlgq67-glitch/shannon-agent-home-public). This app is meant to live at [ixjtlgq67-glitch/shannon](https://github.com/ixjtlgq67-glitch/shannon).

## Credit

Schemas, rubrics, the agent manifest, and the Python reference runner are copied from the public agent home, not rewritten:

https://github.com/ixjtlgq67-glitch/shannon-agent-home-public

Commit `14facd688f571a80d4a01cc1d9897c5c120664ca`. They live in `agent-home/`. Prompt checksums are checked by `npm test`. See `docs/P4A-NOTES.md` for the one seeded-role choice this prototype records.

## Run locally

Node 20 or newer.

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open http://127.0.0.1:43123

Leave the keys in `.env.local` empty. The app then runs the whole path with canned agent output and a local store in `.data/` (gitignored). Confirmation email is not sent; it appears at http://127.0.0.1:43123/inbox for the browser that just signed up.

```sh
npm test
npm run build
npm start
```

The dev server and `npm start` listen on port 43123 unless `PORT` is set.

### Demo path

1. Open the site and choose Start saving. If Supabase anonymous sign-in is on, that creates a private library. If it is off, Shannon says so and keeps the library on this machine.
2. On Save, choose “Load the Harbor Line notes” (a synthetic source) and run the panel.
3. You should see at most eight pending proposals. One fabricated quotation is dropped and recorded in the audit log, not shown as pending.
4. Accept one. Reject another if you want; the optional line goes to the audit log.
5. Sign out, sign in, and search the register for the exact quotation.

Historian does not sit on the first run. Save a second source after an acceptance and Historian is seated.

## Save from the page you are on

The site, the extension, and the help text are English only.

- Chrome or Edge: on Get the save button, download the extension zip and unzip it. Open `chrome://extensions` or `edge://extensions`, turn on Developer mode, and load that folder. The address is already filled in. Paste the save token from Settings. The toolbar button, the right-click menu, and Ctrl+Shift+S (Command+Shift+S on Mac) save the tab you are looking at, including text the server cannot fetch. The zip is also at `/shannon-extension.zip`.
- Bookmarklet: while signed in, open **Get the save button** and drag **Save to Shannon** onto the bookmarks bar. On a page, click that bookmark.

Sign-up opens the library. Help and Get the save button have the same install steps.

With `OPENAI_API_KEY` set and Supabase unset, live agents run against the local store. With Supabase set and no OpenAI key, accounts are real and the panel stays canned. Both together is the deployment configuration.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Live models | Server only. Agents SDK calls. Empty means canned output. |
| `SHANNON_MODEL` | No | Default `gpt-4.1-mini`. |
| `SHANNON_ITEM_CALL_BUDGET` | No | Default 8 calls per saved item, including triage, Conductor, roles, concept, and a retry. |
| `SHANNON_ITEM_BUDGET_USD` | No | Default `0.50`. Unknown prices are not treated as zero. |
| `SHANNON_ROLE_TIMEOUT_MS` | No | Default 25000. A timeout marks the run `INCOMPLETE` and keeps successful proposals. |
| `PUBLIC_URL` | Tunnel | Public https origin. Used when the proxy sends Host as `0.0.0.0`. A public `X-Forwarded-Host` wins over this. |
| `SUPABASE_URL` | Hosted auth | Project URL. Environment only. |
| `SUPABASE_ANON_KEY` | Hosted auth | Public anon key. Environment only. The server acts with the signed-in reader’s JWT. |

Do not prefix the OpenAI key with `NEXT_PUBLIC_`. Shannon does not use a service-role key. Do not commit `.env.local` or `.data/`.

Cost estimates use the versioned table in `lib/shannon/pricing.ts` (`openai-public-list-2025-04` for known OpenAI models, `synthetic-demo-2026` for canned calls). A model that is not in the table is logged with a null cost.

## Supabase

1. Create a project at https://supabase.com/dashboard.
2. Open the SQL editor and run `supabase/migrations/0001_shannon.sql` once. It is safe to run again. It creates the product tables, row-level security, the `decide_proposal` gate, a signup trigger that seeds Practitioner, Economist, and Historian, the personal save-token function, and a private `frozen-sources` bucket. Do not also run the older migration files. No service-role key is required.
   If the storage policies fail because the migration role cannot write `storage.objects`, create a private bucket named `frozen-sources` in Storage and add two policies for `authenticated`: select and insert where the first folder of the object name equals `auth.uid()`. Paragraphs in Postgres remain the source of truth either way.
3. Authentication → Sign In / Providers → Email: enable Email. Turn **Confirm email** off so a new reader lands in the library immediately. Leave the confirmation emails wired if you want them later; the app still accepts `/auth/callback`. For Try it now without an email, also enable Anonymous sign-ins.
4. Authentication → URL configuration:
   - Site URL: `http://127.0.0.1:43123` locally, or your deployed origin.
   - Redirect URLs: `http://127.0.0.1:43123/auth/callback` and `https://<your-host>/auth/callback`.
5. For more than Supabase’s built-in mail limit, set custom SMTP under Authentication → Emails. The default mailer is enough for a class demo.
6. Project Settings → API: copy the project URL, the anon key, and the service role key into `.env.local` or the host’s secret store.

Row-level security limits every product table to `auth.uid()`. Register inserts go through `decide_proposal`, which checks that the quotation is still inside the frozen paragraph. The server reads identity from `supabase.auth.getUser()`, not from a user id sent by the browser.

## Deploy on Vercel

1. Push this repository and import it at https://vercel.com/new. Framework preset: Next.js.
2. Add the environment variables from the table above. Do not mark the service role or OpenAI key as exposed to the browser.
3. Deploy. Vercel sets `PORT`; `npm start` honors it.
4. In Supabase, set Site URL to `https://<project>.vercel.app` and add `https://<project>.vercel.app/auth/callback` as a redirect URL.
5. Sign up with a real inbox, confirm, save a source, accept a proposal, sign out, sign in, and search the quotation.

## Deploy on Replit

1. Create a Replit from this repository (Import from GitHub, or upload).
2. Replit Secrets: the same environment variables. `PORT` is provided by Replit.
3. `.replit` builds with `npm run build` and runs `npm start`, which binds `0.0.0.0` and `PORT` (43123 in local development).
4. Deploy with Replit Deployments (Autoscale). Copy the public `https://` origin into the Supabase Site URL and redirect allow-list, including `/auth/callback`.
5. Run the same sign-up → confirm → save → accept → sign out → sign in → search check on the public URL.

If Replit or Vercel is blocked, the app is a standard Next.js server and can move to another Node host without a rewrite. Keys stay in the host’s environment.

## What the tests cover

`npm test` checks the quotation validator, the Conductor’s call budget and dedupe, the accept/reject gate (including a local sign-up, panel, acceptance, new session, and search), prompt checksums, and that the migration enables row-level security.

The Harbor Line notes used by the demo button and the tests are synthetic. Do not commit private article text.
