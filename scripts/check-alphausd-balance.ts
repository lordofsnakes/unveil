import { createPublicClient, http, formatUnits, erc20Abi } from "viem";
import { Chain } from "viem/tempo";
import { ALPHA_USD, STABLECOIN_DECIMALS, TEMPO_TESTNET } from "../lib/constants";

const client = createPublicClient({
  chain: Chain.moderato,
  transport: http(process.env.TEMPO_RPC_URL ?? TEMPO_TESTNET.rpcHttp),
});

async function main() {
  const addrs = process.argv.slice(2).filter((a) => a.startsWith("0x"));
  for (const a of addrs) {
    const bal = (await client.readContract({
      address: ALPHA_USD,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [a as `0x${string}`],
    })) as bigint;
    console.log(`${a}\t${formatUnits(bal, STABLECOIN_DECIMALS)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
