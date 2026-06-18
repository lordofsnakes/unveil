import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { desc, eq } from "drizzle-orm";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { PrivateKeyAccount } from "viem/accounts";
import { getDb } from "./db";
import { platformSigningKeys } from "./db/schema";

const ENCRYPTION_SECRET_ENV = "CUSTODIAL_KEY_ENCRYPTION_SECRET";

export type PlatformSigningKeyMeta = {
  keyId: string;
  address: `0x${string}`;
  status: "active" | "retired";
};

function getEncryptionKey() {
  const raw = process.env[ENCRYPTION_SECRET_ENV];
  if (!raw) throw new Error(`${ENCRYPTION_SECRET_ENV} is not set`);

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`${ENCRYPTION_SECRET_ENV} must be a base64-encoded 32-byte key`);
  }

  return key;
}

function encryptPrivateKey(privateKey: `0x${string}`) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(privateKey, "utf8"),
    cipher.final(),
  ]);

  return {
    encryptedPrivateKey: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptPrivateKey({
  encryptedPrivateKey,
  iv,
  authTag,
}: {
  encryptedPrivateKey: string;
  iv: string;
  authTag: string;
}) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPrivateKey, "base64")),
    decipher.final(),
  ]).toString("utf8");

  if (!/^0x[0-9a-fA-F]{64}$/.test(decrypted)) {
    throw new Error("Decrypted platform key is malformed");
  }

  return decrypted as `0x${string}`;
}

export function generateCustodialEncryptionSecret() {
  return randomBytes(32).toString("base64");
}

export async function getActivePlatformSigningKeyMeta() {
  const db = getDb();
  const key = await db.query.platformSigningKeys.findFirst({
    where: eq(platformSigningKeys.status, "active"),
    orderBy: [desc(platformSigningKeys.createdAt)],
  });

  if (!key) return null;

  return {
    keyId: key.keyId,
    address: key.address as `0x${string}`,
    status: key.status,
  } satisfies PlatformSigningKeyMeta;
}

export async function getActivePlatformSigningAccount(): Promise<{
  keyId: string;
  account: PrivateKeyAccount;
}> {
  const db = getDb();
  const key = await db.query.platformSigningKeys.findFirst({
    where: eq(platformSigningKeys.status, "active"),
    orderBy: [desc(platformSigningKeys.createdAt)],
  });

  if (!key) throw new Error("No active platform signing key found");

  const privateKey = decryptPrivateKey(key);
  const account = privateKeyToAccount(privateKey);

  if (account.address.toLowerCase() !== key.address.toLowerCase()) {
    throw new Error("Stored platform key address does not match private key");
  }

  return { keyId: key.keyId, account };
}

export async function ensureActivePlatformSigningKey({
  rotate = false,
}: {
  rotate?: boolean;
} = {}) {
  return getDb().transaction(async (tx) => {
    const existing = await tx.query.platformSigningKeys.findFirst({
      where: eq(platformSigningKeys.status, "active"),
      orderBy: [desc(platformSigningKeys.createdAt)],
    });

    if (existing && !rotate) {
      return {
        keyId: existing.keyId,
        address: existing.address as `0x${string}`,
        status: existing.status,
      } satisfies PlatformSigningKeyMeta;
    }

    if (existing) {
      await tx
        .update(platformSigningKeys)
        .set({ status: "retired", retiredAt: new Date() })
        .where(eq(platformSigningKeys.id, existing.id));
    }

    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const keyId = `platform_${randomBytes(12).toString("hex")}`;
    const encrypted = encryptPrivateKey(privateKey);

    const [created] = await tx
      .insert(platformSigningKeys)
      .values({
        keyId,
        address: account.address,
        ...encrypted,
      })
      .returning();

    return {
      keyId: created.keyId,
      address: created.address as `0x${string}`,
      status: created.status,
    } satisfies PlatformSigningKeyMeta;
    });
}
