import { desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import {
  requireCurrentAppUser,
  UnauthorizedError,
} from "@/lib/app-user";
import { CUSTODIAL_ACCOUNT_COOKIE } from "@/lib/custodial";
import { getDb } from "@/lib/db";
import { paymentDeposits } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireCurrentAppUser();
    return Response.json({ payments: await listPayments(user.id) });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      const cookieStore = await cookies();
      const userId = cookieStore.get(CUSTODIAL_ACCOUNT_COOKIE)?.value;
      if (!userId) return Response.json({ payments: [] });
      return Response.json({ payments: await listPayments(userId) });
    }
    throw err;
  }
}

function listPayments(userId: string) {
  return getDb()
    .select({
      id: paymentDeposits.id,
      amount: paymentDeposits.amount,
      currency: paymentDeposits.currency,
      status: paymentDeposits.status,
      provider: paymentDeposits.provider,
      providerTransactionId: paymentDeposits.providerTransactionId,
      destinationWalletAddress: paymentDeposits.destinationWalletAddress,
      tempoFundingTxHash: paymentDeposits.tempoFundingTxHash,
      createdAt: paymentDeposits.createdAt,
      creditedAt: paymentDeposits.creditedAt,
      updatedAt: paymentDeposits.updatedAt,
    })
    .from(paymentDeposits)
    .where(eq(paymentDeposits.userId, userId))
    .orderBy(desc(paymentDeposits.createdAt))
    .limit(20);
}
