# ipoptally — Live Demo Setup (from zero)

Goal: make the demo **real** — click "Run Cycle" → AI generates a landing page → you get a **live URL** anyone can open.

You'll set up 3 free things: **Anthropic API key**, **Supabase** (database + file storage), and **Railway** (runs the backend). Then point the website at it. ~30–45 min.

You do NOT share any keys with anyone. They live only on your Railway backend.

---

## STEP 1 — Get an Anthropic API key (the AI)

1. Go to **console.anthropic.com** → sign up / log in.
2. **Billing** → add a little credit (e.g. $5). The demo uses cheap Haiku; $5 lasts a long time with the rate limit.
3. **API Keys** → Create Key → copy it (starts with `sk-ant-...`). Save it somewhere safe.

---

## STEP 2 — Supabase (stores the generated pages, gives live URLs)

1. Go to **supabase.com** → New project (free tier). Pick any name + password.
2. Wait ~2 min for it to provision.
3. Left sidebar → **Storage** → **New bucket**:
   - Name: `sites`
   - **Public bucket: ON** ✅ (important — this is what makes the URLs openable)
   - Create.
4. Left sidebar → **Project Settings** (gear) → **API**:
   - Copy **Project URL** (like `https://abcd.supabase.co`) → this is `SUPABASE_URL`
   - Under "Project API keys" copy the **`service_role`** key (NOT `anon`) → this is `SUPABASE_SERVICE_KEY`
   - ⚠️ The service_role key is secret. Never put it in the website code — only on the backend.

---

## STEP 3 — Put the backend on GitHub

1. Make a free **github.com** account if you don't have one.
2. New repository → name it `ipoptally-backend` → Create.
3. Upload the files from the **`ipoptally-backend`** folder I gave you:
   `package.json`, `.env.example`, and the `src/` folder (with `server.js`).
   (You can drag-and-drop them in GitHub's "Add file → Upload files".)
   - Do NOT upload `node_modules` if it's there.

---

## STEP 4 — Deploy on Railway (runs the backend 24/7)

1. Go to **railway.app** → sign up with GitHub.
2. **New Project** → **Deploy from GitHub repo** → pick `ipoptally-backend`.
3. Railway auto-detects Node. It will run `npm install` then `npm start`.
4. Go to the service → **Variables** tab → add these (from steps 1–2):

   ```
   ANTHROPIC_API_KEY   = sk-ant-...
   SUPABASE_URL        = https://abcd.supabase.co
   SUPABASE_SERVICE_KEY= eyJ... (the service_role key)
   DEPLOY_BUCKET       = sites
   DAILY_LIMIT         = 5
   ```

5. **Settings** tab → **Networking** → **Generate Domain**.
   You'll get a URL like `https://ipoptally-backend-production.up.railway.app`.
6. Test it: open `https://YOUR-URL/health` in a browser → should show `{"ok":true}`.

---

## STEP 5 — Point the website at the backend

1. Open **`demo-live.html`** (in the `ipoptally-final` folder).
2. Near the top of the `<script>`, set:
   ```js
   const API_BASE = "https://ipoptally-backend-production.up.railway.app";
   ```
   (your Railway URL, no trailing slash)
3. Save.
4. (Optional) Rename `demo-live.html` → `demo.html` to replace the simulated demo,
   OR keep both and link the live one. If you replace it, update the links in `index.html`
   that point to `demo.html` — they'll just work.

---

## STEP 6 — Upload the website to Hostinger

Upload the whole `ipoptally-final` folder (index.html, demo-live.html, whitepaper.html,
favicons) to your `ipoptally.xyz` public_html. Done — the demo now generates real pages.

---

## How the costs stay safe
- `DAILY_LIMIT=5` means each visitor IP can generate max 5 times/day. Raise/lower as you like.
- Model is Haiku (cheap). A generation is a few cents at most.
- If you ever want to pause it, remove the Railway domain or set `DAILY_LIMIT=0`.

## Troubleshooting
- **/health works but generate fails** → check the 3 secret variables on Railway, and that the `sites` bucket is **public**.
- **CORS error in browser** → make sure you're calling the Railway https URL exactly, no trailing slash.
- **"daily_limit"** → that's the rate limit working; try tomorrow or raise DAILY_LIMIT.
- **Page generated but won't open** → bucket isn't public; flip it on in Supabase Storage.

## Going further (after launch)
- Pretty URLs (`name.ipoptally.xyz`) instead of supabase.co links — ask me to wire the Cloudflare/VPS deploy adapter.
- Save companies/tasks to a real database table so progress persists.
- Tie generation credits to $TALLY holdings.
