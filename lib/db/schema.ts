import {
  pgTable,
  text,
  varchar,
  decimal,
  numeric,
  integer,
  jsonb,
  timestamp,
  pgEnum,
  uuid,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const mediaTypeEnum = pgEnum("media_type", ["image", "video"]);

export const loyaltyEventTypeEnum = pgEnum("loyalty_event_type", [
  "post_unlock",
  "tip",
  "streak_bonus",
]);

// ── users ────────────────────────────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletAddress: varchar("wallet_address", { length: 42 }).unique().notNull(),
    // Tempo virtual address for per-user deposits
    tempoVirtualAddress: varchar("tempo_virtual_address", { length: 42 }).unique(),
    username: varchar("username", { length: 32 }).unique(),
    avatar: text("avatar"),
    isCreator: boolean("is_creator").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("users_wallet_idx").on(t.walletAddress)],
);

// ── posts ────────────────────────────────────────────────────────────────────
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    // Public blurred preview — stored in Vercel Blob (public)
    blurredPreviewUrl: text("blurred_preview_url").notNull(),
    // Private full media — stored in Vercel Blob (private), URL/key only
    privateMediaKey: text("private_media_key").notNull(),
    // Price in stablecoin units. e.g. "0.05" = 5 cents
    unlockPrice: decimal("unlock_price", { precision: 18, scale: 8 }).notNull(),
    mediaType: mediaTypeEnum("media_type").notNull().default("image"),
    isPublished: boolean("is_published").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("posts_creator_idx").on(t.creatorId),
    index("posts_feed_idx").on(t.isPublished, t.createdAt),
  ],
);

// ── unlocks ──────────────────────────────────────────────────────────────────
export const unlocks = pgTable(
  "unlocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fanId: uuid("fan_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    // tx hash from Tempo receipt — proof of payment
    paymentTxHash: varchar("payment_tx_hash", { length: 66 }).notNull(),
    amountPaid: decimal("amount_paid", { precision: 18, scale: 8 }).notNull(),
    // how long settlement took in ms (for the "proof of magic" UI)
    settlementMs: integer("settlement_ms"),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    // a fan can only unlock a given post once
    uniqueIndex("unlocks_fan_post_uniq").on(t.fanId, t.postId),
    index("unlocks_fan_idx").on(t.fanId),
  ],
);

// ── loyalty_ledger ───────────────────────────────────────────────────────────
export const loyaltyLedger = pgTable(
  "loyalty_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Points (not USD). 1 unlock = POINTS_PER_UNLOCK points.
    amount: decimal("amount", { precision: 18, scale: 0 }).notNull(),
    eventType: loyaltyEventTypeEnum("event_type").notNull(),
    referenceId: uuid("reference_id"), // unlock.id
    txHash: varchar("tx_hash", { length: 66 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("loyalty_user_idx").on(t.userId)],
);

// ── blur_jobs (auto-blur pipeline) ────────────────────────────────────────────
// One row per asset moving through the detect → (track) → composite → review
// state machine. Mirrors auto-blur/IMPLEMENTATION.md §4. Reuses the existing
// `media_type` enum rather than defining a duplicate.
export const blurStatusEnum = pgEnum("blur_status", [
  "uploaded",
  "detecting",
  "tracking",
  "compositing",
  "ready_for_review",
  "approved",
  "published",
  "failed",
  "manual_review",
]);

// Shared shape for a detected region (used for the review overlay).
export type DetectedRegion = {
  label: string;
  box: [number, number, number, number]; // [x1, y1, x2, y2]
  confidence: number;
  frame?: number; // video only
};

export const blurJobs = pgTable(
  "blur_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id").references(() => posts.id, { onDelete: "set null" }),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mediaType: mediaTypeEnum("media_type").notNull(),
    status: blurStatusEnum("status").notNull().default("uploaded"),

    rawBlobKey: text("raw_blob_key").notNull(), // private — the upload
    blurredBlobUrl: text("blurred_blob_url"), // public — set on success
    originalBlobKey: text("original_blob_key"), // private — set on success

    // One Replicate prediction id per stage, e.g. { detect, track, composite }.
    predictionIds: jsonb("prediction_ids")
      .$type<Record<string, string>>()
      .default({}),
    detectionConfidence: numeric("detection_confidence"), // drives fail-closed routing
    regions: jsonb("regions").$type<DetectedRegion[]>().default([]),
    sourceFps: integer("source_fps"), // video only — so the mask track matches

    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("blur_jobs_creator_idx").on(t.creatorId),
    index("blur_jobs_status_idx").on(t.status),
  ],
);

// Idempotency ledger for Replicate webhook events — a retried/duplicate event
// (same `event.id`) must never advance the state machine twice (PRD §12.6).
export const blurWebhookEvents = pgTable("blur_webhook_events", {
  id: text("id").primaryKey(), // Replicate/svix event id
  jobId: uuid("job_id"),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Relations ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  unlocks: many(unlocks),
  loyaltyEntries: many(loyaltyLedger),
  blurJobs: many(blurJobs),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  creator: one(users, { fields: [posts.creatorId], references: [users.id] }),
  unlocks: many(unlocks),
  blurJobs: many(blurJobs),
}));

export const blurJobsRelations = relations(blurJobs, ({ one }) => ({
  creator: one(users, { fields: [blurJobs.creatorId], references: [users.id] }),
  post: one(posts, { fields: [blurJobs.postId], references: [posts.id] }),
}));

export const unlocksRelations = relations(unlocks, ({ one }) => ({
  fan: one(users, { fields: [unlocks.fanId], references: [users.id] }),
  post: one(posts, { fields: [unlocks.postId], references: [posts.id] }),
}));

export const loyaltyLedgerRelations = relations(loyaltyLedger, ({ one }) => ({
  user: one(users, { fields: [loyaltyLedger.userId], references: [users.id] }),
}));
