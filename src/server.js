// server.js — ipoptally demo backend
// Generates a real landing page with Claude, stores it in Supabase Storage,
// and returns a LIVE URL that opens in the browser.

import Fastify from 'fastify';
import cors from '@fastify/cors';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true }); // allow your site to call this

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const BUCKET = process.env.DEPLOY_BUCKET || 'sites';
const MODEL = 'claude-haiku-4-5-20251001'; // cheap + fast for demos

// ---- simple per-IP rate limit so the demo can't drain your API credits ----
const HITS = new Map(); // ip -> { count, day }
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT || 5);
function rateLimited(ip) {
  const today = new Date().toISOString().slice(0, 10);
  const rec = HITS.get(ip);
  if (!rec || rec.day !== today) { HITS.set(ip, { count: 1, day: today }); return false; }
  if (rec.count >= DAILY_LIMIT) return true;
  rec.count++; return false;
}

function slugify(s) {
  return (s || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32)
    + '-' + Math.random().toString(36).slice(2, 7); // unique suffix
}

const SYSTEM = `You are a senior frontend engineer. Output ONLY a complete single-file index.html.
No markdown, no backticks, no commentary. Inline all CSS. You may use Google Fonts and
the Tailwind CDN (<script src="https://cdn.tailwindcss.com"></script>).
Make it modern, responsive, and visually polished — never generic. Include: nav, a strong
hero with headline + subtext + CTA button, 3 feature cards, and a footer. Match the requested vibe.`;

app.get('/health', async () => ({ ok: true }));

// MAIN: generate + deploy a landing page, return live URL
app.post('/generate', async (req, reply) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  if (rateLimited(ip)) return reply.code(429).send({ error: 'daily_limit', message: `Demo limit reached (${DAILY_LIMIT}/day). Try again tomorrow.` });

  const { idea, name, vibe } = req.body || {};
  if (!idea) return reply.code(400).send({ error: 'idea_required' });

  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: 'user', content:
        `Business: ${idea}\nName: ${name || 'the brand'}\nVibe: ${vibe || 'modern, bold'}\nReturn the full index.html now.` }],
    });
    let html = res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    // strip accidental code fences just in case
    html = html.replace(/^```html?\s*/i, '').replace(/```\s*$/i, '');

    const slug = slugify(name || idea);
    const path = `${slug}/index.html`;
    const { error } = await supabase.storage.from(BUCKET)
      .upload(path, Buffer.from(html, 'utf-8'), {
        upsert: true,
        contentType: 'text/html; charset=utf-8',
        cacheControl: '3600',
      });
    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { ok: true, url: data.publicUrl, slug };
  } catch (err) {
    app.log.error(err);
    return reply.code(500).send({ error: 'generation_failed', message: err.message });
  }
});

// Text tasks (research / outreach / tweet) — returns text, no deploy
app.post('/task', async (req, reply) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  if (rateLimited(ip)) return reply.code(429).send({ error: 'daily_limit' });

  const { kind, idea } = req.body || {};
  if (!idea || !kind) return reply.code(400).send({ error: 'idea_and_kind_required' });

  const prompts = {
    research: ['You are a sharp market analyst. Write a concise competitor + opportunity report in clean Markdown. Be specific.', `Business idea: ${idea}\nWrite the report.`],
    outreach: ['You write short, warm, non-spammy outreach. Output one message under 80 words, plain text.', `Product: ${idea}\nWrite one outreach message to a first customer.`],
    tweet: ['You write punchy launch tweets under 280 chars. Output ONLY the tweet.', `Write a launch tweet for: ${idea}`],
  };
  const p = prompts[kind];
  if (!p) return reply.code(400).send({ error: 'bad_kind' });

  try {
    const res = await anthropic.messages.create({
      model: MODEL, max_tokens: 1500, system: p[0],
      messages: [{ role: 'user', content: p[1] }],
    });
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    return { ok: true, text };
  } catch (err) {
    return reply.code(500).send({ error: 'task_failed', message: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen({ port, host: '0.0.0.0' }).then(() => app.log.info(`ipoptally demo api on :${port}`));
