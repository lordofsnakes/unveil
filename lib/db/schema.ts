import {
  pgTable,
  text,
  varchar,
  decimal,
  integer,
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

// ── Relations ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  unlocks: many(unlocks),
  loyaltyEntries: many(loyaltyLedger),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  creator: one(users, { fields: [posts.creatorId], references: [users.id] }),
  unlocks: many(unlocks),
}));

export const unlocksRelations = relations(unlocks, ({ one }) => ({
  fan: one(users, { fields: [unlocks.fanId], references: [users.id] }),
  post: one(posts, { fields: [unlocks.postId], references: [posts.id] }),
}));

export const loyaltyLedgerRelations = relations(loyaltyLedger, ({ one }) => ({
  user: one(users, { fields: [loyaltyLedger.userId], references: [users.id] }),
}));
