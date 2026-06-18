// Unit test for the webhook signature verification (PRD §12.5). No network, no
// DB, no deploy: sign payloads with svix (the scheme Replicate uses) and assert
// verifyReplicateWebhook accepts valid ones and rejects tampered/forged ones.
//
//   tsx scripts/blur-webhook-test.ts
import { Webhook } from "svix";
import { verifyReplicateWebhook } from "../lib/blur/webhook";

const SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw"; // svix sample test secret
process.env.REPLICATE_WEBHOOK_SECRET = SECRET;

function signedHeaders(id: string, payload: string) {
  const ts = new Date();
  const sig = new Webhook(SECRET).sign(id, ts, payload);
  return {
    "webhook-id": id,
    "webhook-timestamp": String(Math.floor(ts.getTime() / 1000)),
    "webhook-signature": sig,
  };
}

let pass = 0;
let fail = 0;
const check = (cond: boolean, msg: string) => {
  if (cond) {
    pass++;
    console.log("  ✓ " + msg);
  } else {
    fail++;
    console.log("  ✗ " + msg);
  }
};

const payload = JSON.stringify({
  id: "evt_abc123",
  status: "succeeded",
  output: ["annotated", "neg", "mask", "inverted"],
});
const headers = signedHeaders("msg_1", payload);

// 1. Valid signature → parses the event.
try {
  const ev = verifyReplicateWebhook(payload, headers);
  check(ev.id === "evt_abc123" && ev.status === "succeeded", "valid signature → parsed event");
} catch (e) {
  check(false, `valid signature → parsed event (threw: ${e})`);
}

// 2. Tampered body → rejected (would be 401).
try {
  verifyReplicateWebhook(payload + " ", headers);
  check(false, "tampered body → rejected");
} catch {
  check(true, "tampered body → rejected");
}

// 3. Forged with the wrong secret → rejected.
try {
  const forged = signedHeaders("msg_2", payload); // signed with SECRET...
  process.env.REPLICATE_WEBHOOK_SECRET =
    "whsec_" + Buffer.from("a-totally-different-signing-key!!").toString("base64");
  verifyReplicateWebhook(payload, forged); // ...but verified against a different one
  check(false, "wrong secret → rejected");
} catch {
  check(true, "wrong secret → rejected");
} finally {
  process.env.REPLICATE_WEBHOOK_SECRET = SECRET;
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
