// Seed demo content: a creator + posts, a fan with unlocks (so the collection
// and notifications populate), and a DM thread with text + one PPV message.
// Uploads a public blurred preview and a PRIVATE full image per post.
//
//   npm run seed
//
// Requires DATABASE_URL and BLOB_READ_WRITE_TOKEN in .env.local.
import { randomBytes } from "node:crypto";
import { put } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { getDb } from "../lib/db";
import {
  users,
  posts,
  unlocks,
  loyaltyLedger,
  threads,
  messages,
} from "../lib/db/schema";
import { POINTS_PER_UNLOCK } from "../lib/constants";
import { makeFull, makePreview } from "./demo-image";

const DEMO_CREATOR_WALLET =
  process.env.DEMO_CREATOR_WALLET?.toLowerCase() ??
  "0x1111111111111111111111111111111111111111";
const DEMO_FAN_WALLET =
  process.env.DEMO_FAN_WALLET?.toLowerCase() ??
  "0x2222222222222222222222222222222222222222";

const DEMO_POSTS = [
  { name: "post1", title: "Golden hour rooftop", price: "0.05", seed: 7 },
  { name: "post2", title: "Backstage, unfiltered", price: "0.10", seed: 13 },
  { name: "post3", title: "The full set", price: "0.25", seed: 23 },
];

const txHash = () => "0x" + randomBytes(32).toString("hex");

async function seed() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    throw new Error("BLOB_READ_WRITE_TOKEN not set");

  const db = getDb();

  // 1. Creator + fan
  const [creator] = await db
    .insert(users)
    .values({
      walletAddress: DEMO_CREATOR_WALLET,
      username: "demo_creator",
      isCreator: true,
    })
    .onConflictDoUpdate({
      target: users.walletAddress,
      set: { username: "demo_creator", isCreator: true },
    })
    .returning();

  const [fan] = await db
    .insert(users)
    .values({ walletAddress: DEMO_FAN_WALLET, username: "demo_fan" })
    .onConflictDoUpdate({
      target: users.walletAddress,
      set: { username: "demo_fan" },
    })
    .returning();

  console.log(`creator: ${creator.username} (${creator.id})`);
  console.log(`fan: ${fan.username} (${fan.id})`);

  // Idempotency: drop this creator's posts (cascades unlocks), the fan's
  // loyalty, and any existing thread between the two.
  await db.delete(posts).where(eq(posts.creatorId, creator.id));
  await db.delete(loyaltyLedger).where(eq(loyaltyLedger.userId, fan.id));
  await db
    .delete(threads)
    .where(and(eq(threads.creatorId, creator.id), eq(threads.fanId, fan.id)));

  // 2. Posts
  const created: { id: string; price: string }[] = [];
  for (const { name, title, price, seed: s } of DEMO_POSTS) {
    const full = makeFull(s);
    const preview = makePreview(s);

    const previewBlob = await put(`previews/${name}.png`, preview, {
      access: "private",
      contentType: "image/png",
      allowOverwrite: true,
    });
    const privateBlob = await put(`media/${name}/original.png`, full, {
      access: "private",
      contentType: "image/png",
      allowOverwrite: true,
    });

    const [post] = await db
      .insert(posts)
      .values({
        creatorId: creator.id,
        title,
        blurredPreviewUrl: previewBlob.pathname,
        privateMediaKey: privateBlob.pathname,
        unlockPrice: price,
        mediaType: "image",
        isPublished: true,
      })
      .returning();
    created.push({ id: post.id, price });
    console.log(`post: ${title} — $${price}`);
  }

  // 3. Fan unlocks the first two posts → seeds the collection + the creator's
  //    notifications + loyalty balance.
  for (const { id, price } of created.slice(0, 2)) {
    const hash = txHash();
    const [unlock] = await db
      .insert(unlocks)
      .values({
        fanId: fan.id,
        postId: id,
        paymentTxHash: hash,
        amountPaid: price,
        settlementMs: 300 + Math.round(Number(price) * 1000),
      })
      .returning();
    await db.insert(loyaltyLedger).values({
      userId: fan.id,
      amount: String(POINTS_PER_UNLOCK),
      eventType: "post_unlock",
      referenceId: unlock.id,
      txHash: hash,
    });
  }
  console.log("unlocks: 2 (fan → creator)");

  // 4. A DM thread with a few messages, including one PPV card pointing at the
  //    still-locked third post (the fan can unlock it from the conversation).
  const [thread] = await db
    .insert(threads)
    .values({ creatorId: creator.id, fanId: fan.id })
    .returning();

  const base = Date.now() - 60_000;
  const ppvPost = created[2];
  const script = [
    { senderId: creator.id, kind: "text" as const, body: "Hey you — so glad you made it 💋", postId: null },
    { senderId: fan.id, kind: "text" as const, body: "Just unlocked your set. Obsessed already.", postId: null },
    { senderId: creator.id, kind: "ppv" as const, body: "A little something just for you 🔥", postId: ppvPost.id },
    { senderId: creator.id, kind: "text" as const, body: "Let me know what you think 😘", postId: null },
  ];
  for (let i = 0; i < script.length; i++) {
    await db.insert(messages).values({
      threadId: thread.id,
      senderId: script[i].senderId,
      kind: script[i].kind,
      body: script[i].body,
      postId: script[i].postId,
      createdAt: new Date(base + i * 1000),
    });
  }
  await db
    .update(threads)
    .set({ lastMessageAt: new Date(base + script.length * 1000) })
    .where(eq(threads.id, thread.id));
  console.log(`thread: ${thread.id} (${script.length} messages, 1 PPV)`);

  console.log("✓ seed complete");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
