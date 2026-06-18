import {
  ensureActivePlatformSigningKey,
  generateCustodialEncryptionSecret,
} from "../lib/platform-key-vault";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!process.env.CUSTODIAL_KEY_ENCRYPTION_SECRET) {
    console.error("CUSTODIAL_KEY_ENCRYPTION_SECRET is not set.");
    console.error("Generate one and store it in .env.local / Vercel secrets:");
    console.error(`CUSTODIAL_KEY_ENCRYPTION_SECRET=${generateCustodialEncryptionSecret()}`);
    process.exit(1);
  }

  const rotate = process.argv.includes("--rotate");
  const key = await ensureActivePlatformSigningKey({ rotate });

  console.log(`${rotate ? "rotated" : "active"} platform key`);
  console.log(`keyId: ${key.keyId}`);
  console.log(`address: ${key.address}`);
  console.log("private key: encrypted in database; raw key was not printed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
