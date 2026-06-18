# Veil

Pay-per-tap, blur-to-reveal premium content on Tempo. Creators upload private media, the app stores originals in private Supabase Storage, and fans unlock short-lived signed URLs after payment.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router, React 19, webpack build |
| Chain | Tempo Moderato testnet, wagmi, viem, `wagmi/tempo` |
| Wallet | Tempo Wallet passkey connector and access keys |
| DB | Supabase Postgres with Drizzle ORM |
| Storage | Private Supabase Storage bucket with signed URLs |
| PWA | Serwist service worker |

## Local Setup

Create `.env.local` with:

```bash
DATABASE_URL=
DATABASE_URL_UNPOOLED=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=media
NEXT_PUBLIC_PLATFORM_WALLET=
PLATFORM_WALLET_ADDRESS=
PLATFORM_PRIVATE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Use the Supabase pooled connection string for `DATABASE_URL`. Use the direct connection string for `DATABASE_URL_UNPOOLED` only if it resolves from your machine; otherwise leave it unset so Drizzle uses the pooled URL. If your database password contains URL-special characters, use Supabase's copied URI or URL-encode the password.

In Supabase Storage, create a private bucket named `media`, or set `SUPABASE_STORAGE_BUCKET` to the private bucket name you use.

## Run

```bash
npm install
npm run db:push
npm run seed
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run build
npm run db:push
npm run seed
npm run token:create
```

## Notes

- `npm run db:push` creates the Supabase tables from `lib/db/schema.ts`.
- `npm run seed` uploads demo media to Supabase Storage and seeds demo posts, unlocks, loyalty, and messages.
- The active unlock UI uses the Tempo wallet hook and posts a payment tx hash to `/api/unlock`.
- Hackathon build. Testnet only. Never commit real keys.
