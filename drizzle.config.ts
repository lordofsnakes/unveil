import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // MUST use the unpooled (direct) URL for DDL operations.
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
} satisfies Config;
