import { TEMPO_TESTNET } from "./constants";

/**
 * Verify a Tempo payment receipt server-side.
 *
 * Hackathon level: confirm the tx exists and its receipt status is success
 * (0x1). Production hardening (a TODO): decode the TIP-20 Transfer log to
 * assert the recipient == platform wallet and value >= unlock price.
 */
export async function verifyTempoPayment(
  txHash: string,
  _expectedAmount: string,
  _fromAddress: string,
): Promise<boolean> {
  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) return false;

  try {
    const res = await fetch(TEMPO_TESTNET.rpcHttp, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [txHash],
      }),
      // Receipts settle in ~500ms; don't hang the request forever.
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as {
      result?: { status?: string } | null;
    };
    const result = json.result;
    if (!result) return false;
    return result.status === "0x1";
  } catch {
    return false;
  }
}
