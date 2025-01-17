import { COIN_ADDRESSES } from "../config/config";
export  const formatPoolInfo = (data: any) => {
  if (!data) return "Pool information not available";

  const tokenNames = data.tokens.map((addr: string) => {
    const symbol =
      Object.entries(COIN_ADDRESSES).find(
        ([_, address]) => address === addr
      )?.[0] || "Unknown";
    return symbol;
  });

  const reserves = data.reserves.map((r: string | bigint): string => {
    const value = Number(r) / 1e9;
    return value.toLocaleString("en-US", {
      maximumFractionDigits: 2,
    });
  });

  const tokenReservePairs = tokenNames.map(
    (token: string, i: number) =>
      `${token.padEnd(10)}: ${reserves[i].padStart(12)}`
  );

  return `Pool Information
================
ID: ${data.id}

Tokens and Reserves:
${tokenReservePairs.join("\n")}

Pool Stats:
• TVL: $${Number(data.tvl).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}
• Daily Fees: $${Number(data.fee).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}
• APR: ${Number(data.apr).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}%`;
};