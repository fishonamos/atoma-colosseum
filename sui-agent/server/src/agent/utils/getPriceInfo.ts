import {
  getTokenPrice,
  getCoinsPriceInfo,
  getPool,
  getAllPools,
  getPoolSpotPrice,
  getTradeRoute,
  getStakingPositions,
  getDcaOrders,
} from "../tools";
import { COIN_ADDRESSES } from "../config/config";
import { formatPoolInfo } from "./FormatPoolInfo";
import createPricePrompt from "../prompts/pricePrompt";
import atomaSDK from "../config/atoma";
import { ActionResult } from "../../../@types";
export async function getPriceInfo(query: string) {
  try {
    // Get AI response
    const result = await atomaSDK.chat.create({
      messages: [
        {
          content: createPricePrompt(query),
          role: "user",
        },
      ],
      model: "meta-llama/Llama-3.3-70B-Instruct",
      maxTokens: 128,
    });

    // Extract JSON from markdown response
    const content = result.choices[0].message.content;
    const jsonMatch =
      content.match(/```(?:json)?\n([\s\S]*?)\n```/) ||
      content.match(/({[\s\S]*})/);
    const jsonString = jsonMatch ? jsonMatch[1].trim() : content.trim();

    try {
      // Parse the AI response
      const aiResponse = JSON.parse(jsonString);

      // Validate AI response
      if (aiResponse.status === "error") {
        throw new Error(aiResponse.error_message);
      }

      if (aiResponse.status === "requires_info") {
        return {
          status: "needs_info",
          request: aiResponse.request,
        };
      }

      
      const results: ActionResult[] = [];
      for (const action of aiResponse.actions) {
        console.log(`Executing action: ${action.tool}`);
        console.log("Input parameters:", action.input);

        // Execute the appropriate tool
        let result: unknown = null;
        switch (action.tool) {
          case "get_token_price":
            result = await getTokenPrice(
              action.input.token_type,
              action.input.network
            );
            break;
          case "get_coins_price_info":
            result = await getCoinsPriceInfo(
              action.input.coins,
              action.input.network
            );
            break;
          case "get_pool_info":
            result = await getPool(action.input.pool_id, action.input.network);
            break;
          case "get_all_pools":
            result = await getAllPools(action.input.network);
            break;
          case "get_pool_spot_price":
            result = await getPoolSpotPrice(
              action.input.pool_id,
              action.input.coin_in_type,
              action.input.coin_out_type,
              action.input.with_fees,
              action.input.network
            );
            break;
          case "get_trade_route":
            result = await getTradeRoute(
              action.input.coin_in_type,
              action.input.coin_out_type,
              BigInt(action.input.coin_in_amount),
              action.input.network
            );
            break;
          case "get_staking_positions":
            result = await getStakingPositions(
              action.input.wallet_address,
              action.input.network
            );
            break;
          case "get_dca_orders":
            result = await getDcaOrders(
              action.input.wallet_address,
              action.input.network
            );
            break;
        }

        results.push({
          tool: action.tool,
          result,
        });
      }

      // Format final answer using the results
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
          })} in daily fees, and offers an APR of ${Number(
            data.apr
          ).toLocaleString("en-US", {
            maximumFractionDigits: 2,
          })}%.`;

          finalAnswer = `${summary}\n\n${formatPoolInfo(data)}`;
        }
        // Add special handling for spot price
        else if (action.tool === "get_pool_spot_price") {
          const spotPrice = Number(data).toFixed(6);
          const inToken =
            action.input.coin_in_type.split("::").pop() || "token";
          const outToken =
            action.input.coin_out_type.split("::").pop() || "token";
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
          const prices = Object.entries(data).map(
            ([addr, info]: [string, any]) => {
              const symbol =
                Object.entries(COIN_ADDRESSES).find(
                  ([_, address]) => address === addr
                )?.[0] || addr.split("::")[2];

              return `${symbol}: $${Number(info.current).toLocaleString(
                "en-US",
                {
                  maximumFractionDigits: 2,
                }
              )}`;
            }
          );

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

      return {
        status: "success",
        reasoning: aiResponse.reasoning,
        results,
        final_answer: finalAnswer,
      };
    } catch (error) {
      console.error("Failed to parse AI response:", jsonString);
      throw new Error("Failed to parse AI response");
    }
  } catch (error) {
    console.error("Error:", error);
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
