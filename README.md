# Veil

**Pay-per-tap, blur-to-reveal premium content — a mobile PWA on [Tempo](https://tempo.xyz).**

Every post hides its best part behind a blur. One tap pays a few cents in
stablecoin and instantly unveils it — no card, no checkout, no gas. The "proof of
magic" chip on every unlock (`$0.02 · 480ms · $0 gas`) is the thing a card-based
app physically can't show.

**Live:** https://mpp-onlyfans.vercel.app

---

## Why it's interesting

- **Sub-cent payments that settle in ~500ms** — a real micro-unlock economy, not a
  subscription. Powered by Tempo TIP-20 stablecoin transfers.
- **One tap, no popups** — a one-time access-key authorization lets every
  subsequent unlock sign silently (no biometric prompt per tap).
- **Gasless** — fees are sponsored (hosted fee payer), so fans pay only the price.
- **Server-side gating** — the unblurred media is never sent to the client until an
  on-chain payment is verified; it then arrives via a short-TTL signed URL.
- **Loyalty + creator economics** — each unlock mints VEIL loyalty points and splits
  revenue 90/10 to the creator on-chain.
- **Auto-blur pipeline** — creators upload once; regions are detected and blurred
  automatically (hosted inference), with a fail-closed creator review gate.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React 19) — **webpack build** (Serwist PWA conflicts with Turbopack) |
| Styling | Tailwind v4 (`@theme` tokens in `globals.css`), framer-motion |
| Chain | Tempo Moderato testnet (chain `42431`), wagmi + viem + `wagmi/tempo` |
| Wallet | `tempoWallet` passkey connector (Face ID), access keys, hosted fee sponsor |
| DB | Neon Postgres + Drizzle ORM |
| Storage | Vercel Blob (private) + signed URLs |
| Share | `@vercel/og` flex-card image |
| PWA | Serwist service worker, installable, offline shell |

## Architecture — the unlock loop

```
tap "Unlock · $0.02"
  → access-key-signed TIP-20 AlphaUSD transfer to the platform wallet (gasless)
  → POST /api/unlock  — verifies the on-chain receipt (token, recipient, amount, payer)
  → short-TTL signed URL for the private original
  → RevealMedia plays (blur lifts + crimson shimmer); ProofChip springs up
  → best-effort: 90% creator payout + VEIL loyalty mint (never blocks the reveal)
```

### Creator upload → auto-blur → publish

```
POST /api/posts            upload raw media (private blob) + create a blur job
                           carrying the draft caption + price. No post yet.
  → blur pipeline          detect regions → composite blur → ready_for_review
  → creator review/approve POST /api/blur/jobs/:id/approve → publishJob() creates the
                           public post from the blurred derivative (fail-closed:
                           nothing is public until approved)
```

## Project layout

```
app/
  page.tsx                 feed (server) + ConnectGate
  profile/ new/ messages/ notifications/   screens
  api/
    unlock/                verify payment → signed URL → split + loyalty
    loyalty/               VEIL balance + lifetime stats
    posts/                 creator upload (raw blob + blur job)  ← upload flow
    og/flex-card/          shareable PnL card image
    blur/                  auto-blur pipeline (ingest, webhook, jobs, approve…)
components/                design system + UnlockButton / RevealMedia / ProofChip…
lib/
  wagmi.ts tempo-server.ts blob.ts constants.ts
  db/                      schema, queries, drizzle
  blur/                    auto-blur pipeline internals
```

## Local setup

```bash
npm install
cp .env.example .env.local        # then fill in the values (see below)
npm run db:push                   # create tables in Neon
npm run seed                      # demo creator + 3 posts
npm run dev                       # http://localhost:3000
```

### Required env (`.env.local`)

`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BLOB_READ_WRITE_TOKEN`,
`NEXT_PUBLIC_TEMPO_CHAIN_ID=42431`, `TEMPO_RPC_URL`, `NEXT_PUBLIC_FEE_PAYER_URL`,
`PLATFORM_WALLET_ADDRESS`, `PLATFORM_PRIVATE_KEY`, `NEXT_PUBLIC_PLATFORM_WALLET`,
`NEXT_PUBLIC_VEIL_TOKEN_ADDRESS`, `ENABLE_ONCHAIN_REWARDS`, `SIGNED_URL_SECRET`,
`NEXT_PUBLIC_APP_URL`. Auto-blur additionally uses `REPLICATE_*` / `BLUR_*` vars
(optional — uploads still work without them; the job just waits).

> `vercel env pull` **overwrites** `.env.local` — re-merge the Tempo/app vars after.

## Scripts

```bash
npm run dev            # dev server
npm run build          # production build (webpack — required for Serwist)
npm run db:push        # push Drizzle schema to Neon
npm run seed           # seed demo creator + posts
npm run token:create   # deploy the VEIL TIP-20 token + grant ISSUER role
```

## Deploy (Vercel)

1. Set all env vars in the Vercel project (Production).
2. `npm run db:push` against the **production** Neon database.
3. Deploy — `vercel deploy --prod`. The build command is pinned to
   `next build --webpack` in `vercel.json`.

## 3-minute demo script

1. **Open on a phone → Add to Home Screen.** It installs like a native app.
2. **"Sign in with Face ID."** One passkey tap; an access key authorizes a small
   spend cap so the rest of the demo has zero prompts.
3. **The feed.** A vertical card feed; the juicy media is blurred behind a wine
   "Unlock · $0.02" pill.
4. **Tap to unlock — the money shot.** Haptic → spinner → the blur lifts with a
   crimson shimmer → the **ProofChip** springs up: `Settled · $0.02 · 480ms · $0 gas`.
   Land on those two numbers — **sub-second settle** and **$0 gas**.
5. **Do it again.** No popup this time (access key) — taps feel instant.
6. **Profile.** Lifetime proof strip (unlocked / paid / avg settle / $0 gas), VEIL
   balance, and the **Flex Card** — share it (a `@vercel/og` PnL image).
7. **Close:** every unlock also paid the creator 90% and minted loyalty, on-chain,
   in the background — none of which blocked the reveal.

---

*Hackathon build. Testnet only — never commit real keys.*
