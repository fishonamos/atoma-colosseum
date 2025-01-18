import { COIN_ADDRESSES } from "../config/config";
import { formatPoolInfo } from "./FormatPoolInfo";
import { ActionResult } from "../../../@types";

export default function formatFinalAnswer(
  aiResponse: any,
  results: ActionResult[],
  query: string
) {
  let finalAnswer = aiResponse.final_answer;
  if (results.length > 0 && results[0].result) {
    const data = results[0].result as any;
    const action = aiResponse.actions[0];

    // If it's a pool info query, replace the entire result
    if (
      action.tool === "get_pool_info" &&
      (finalAnswer.includes("${result}") ||
        finalAnswer === "Pool Information: No data available")
    ) {
      const summary = `This pool has a Total Value Locked (TVL) of $${Number(
        data.tvl
      ).toLocaleString("en-US", {
        maximumFractionDigits: 2,
      })}, generates $${Number(data.fee).toLocaleString("en-US", {
        maximumFractionDigits: 2,
      })} in daily fees, and offers an APR of ${Number(data.apr).toLocaleString(
        "en-US",
        {
          maximumFractionDigits: 2,
        }
      )}%.`;

      finalAnswer = `${summary}\n\n${formatPoolInfo(data)}`;
    }
    // Add special handling for spot price
    else if (action.tool === "get_pool_spot_price") {
      const spotPrice = Number(data).toFixed(6);
      const inToken = action.input.coin_in_type.split("::").pop() || "token";
      const outToken = action.input.coin_out_type.split("::").pop() || "token";
      finalAnswer = `The current spot price is ${spotPrice} ${outToken} per ${inToken}`;
    }
    // Add special handling for fee queries
    else if (
      action.tool === "get_pool_info" &&
      query.toLowerCase().includes("fee")
    ) {
      const dailyFees = Number(data.fee).toLocaleString("en-US", {
        maximumFractionDigits: 2,
      });
      finalAnswer = `The daily trading fees for this pool are $${dailyFees}`;
    }
    // Add special handling for coin price queries
    else if (action.tool === "get_coins_price_info") {
      const prices = Object.entries(data).map(([addr, info]: [string, any]) => {
        const symbol =
          Object.entries(COIN_ADDRESSES).find(
            ([_, address]) => address === addr
          )?.[0] || addr.split("::")[2];

        return `${symbol}: $${Number(info.current).toLocaleString("en-US", {
          maximumFractionDigits: 2,
        })}`;
      });

      finalAnswer = `Current prices:\n${prices.join("\n")}`;
    } else {
      finalAnswer = finalAnswer.replace(
        /\${([^}]+)}/g,
        (match: string, p1: string) => {
          try {
            if (p1.includes("results[")) {
              // For multiple coins (existing logic)
              const matches = p1.match(/results\['([^']+)'\]\.(.+)/);
              if (!matches) return match;
              const [_, coin, field] = matches;

              // special case for SUI's address
              const normalizedCoin =
                coin === "0x2::sui::SUI"
                  ? "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI"
                  : coin;

              return data[normalizedCoin]?.[field]?.toFixed(3) || match;
            } else {
              // For single result
              const path = p1.replace(/^result\./, "").split(".");
              let value = data;
              for (const key of path) {
                value = value[key];
              }

              // Special handling for arrays and objects
              if (Array.isArray(value)) {
                return value.length === 0
                  ? "No data found"
                  : JSON.stringify(value, null, 2);
              } else if (typeof value === "object" && value !== null) {
                if (action.tool === "get_pool_info") {
                  return formatPoolInfo(value);
                }
                return JSON.stringify(value, null, 2);
              }

              return !isNaN(value)
                ? Number(value).toFixed(3)
                : value?.toString() || "No data available";
            }
          } catch {
            return "Error processing data";
          }
        }
      );
    }
  }
  return finalAnswer;
}
