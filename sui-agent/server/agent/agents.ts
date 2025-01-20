import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import path from "path";
import { TransactionAgent } from "./transactionAgent";

// Configure dotenv with explicit path
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Replace OpenAI with Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

import { TOOL_DEFINITIONS, type ToolInput } from "./toolDefinitions";
import {
  getTokenPrice,
  getCoinsPriceInfo,
  getPool,
  getAllPools,
  getPoolSpotPrice,
  getTradeRoute,
  getStakingPositions,
  getDcaOrders,
} from "../markets/PriceAnalysis";
import { COIN_ADDRESSES } from "../common/config";
import { PoolInfo, TokenPrice } from "../common/types";
import { createSuiSagePrompt } from "./prompt";

// Add the ActionResult interface
interface ActionResult {
  tool: string;
  result: unknown;
  action?: {
    tool: string;
    input: Record<string, any>;
  };
}

// Add after the ActionResult interface
type ToolFunction = (...args: any[]) => Promise<unknown>;

// Create a map of tool implementations
const toolImplementations: Record<string, ToolFunction> = {
  get_token_price: getTokenPrice,
  get_coins_price_info: getCoinsPriceInfo,
  get_pool_info: getPool,
  get_all_pools: getAllPools,
  get_pool_spot_price: getPoolSpotPrice,
  get_trade_route: getTradeRoute,
  get_staking_positions: getStakingPositions,
  get_dca_orders: getDcaOrders,
};

// // Initialize the Atoma SDK with proper authentication
// const atomaSDK = new AtomaSDK({
//   bearerAuth: process.env.ATOMASDK_BEARER_AUTH,
// });

// Add new formatting functions
const formatSingleValue = (data: any, field: string, subfield?: string) => {
  if (!data) return "Data not available";

  let value = data[field];
  if (subfield && typeof value === "object") {
    value = value[subfield];
  }

  switch (field) {
    case "apr":
      return `APR: ${value}%`;
    case "tvl":
      return `TVL: $${Number(value).toLocaleString("en-US", {
        maximumFractionDigits: 2,
      })}`;
    case "reserves":
      if (typeof value === "object" && Array.isArray(value)) {
        const tokenNames = data.tokens.map((addr: string) => {
          const symbol =
            Object.entries(COIN_ADDRESSES).find(
              ([_, address]) => address === addr
            )?.[0] || "Unknown";
          return symbol;
        });

        if (subfield && !isNaN(parseInt(subfield))) {
          const idx = parseInt(subfield);
          const formattedValue = (
            Number(value[idx]) /
            1e9 /
            1e6
          ).toLocaleString("en-US", {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2,
          });
          return `${tokenNames[idx]} Reserve: ${formattedValue}M`;
        }
      }
      return `${field}: ${value}`;
    default:
      return `${field}: ${value}`;
  }
};

// Update the formatting logic in getPriceInfo function
const formatPoolInfo = (data: any) => {
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

// Add this helper function
function convertCoinSymbolToAddress(symbol: string): string {
  const address =
    COIN_ADDRESSES[symbol.toUpperCase() as keyof typeof COIN_ADDRESSES];
  if (!address) {
    throw new Error(`Unknown coin symbol: ${symbol}`);
  }
  return address;
}

// Update the interface
interface Tool {
  name: string;
  description: string;
  inputs: ToolInput[];
  output?: {
    type: string;
    description: string;
  };
}

// Update the executeAction function
async function executeAction(action: {
  tool: string;
  input: Record<string, any>;
}): Promise<unknown> {
  // Validate that the tool exists
  const toolDef = Object.values(TOOL_DEFINITIONS)
    .flatMap((category) => category.tools)
    .find((tool) => tool.name === action.tool) as Tool | undefined;

  if (!toolDef) {
    throw new Error(`Unknown tool: ${action.tool}`);
  }

  // Convert coin symbols to addresses where needed
  const processedInput = { ...action.input };
  if (
    action.tool === "get_coins_price_info" &&
    Array.isArray(action.input.coins)
  ) {
    processedInput.coins = action.input.coins.map(convertCoinSymbolToAddress);
  } else if (action.tool === "get_token_price" && action.input.token_type) {
    processedInput.token_type = convertCoinSymbolToAddress(
      action.input.token_type
    );
  } else if (action.tool === "get_pool_spot_price") {
    if (action.input.coin_in_type) {
      processedInput.coin_in_type = convertCoinSymbolToAddress(
        action.input.coin_in_type
      );
    }
    if (action.input.coin_out_type) {
      processedInput.coin_out_type = convertCoinSymbolToAddress(
        action.input.coin_out_type
      );
    }
  }

  // Validate inputs against tool definition
  for (const inputDef of toolDef.inputs as ToolInput[]) {
    if (!inputDef.optional && !(inputDef.name in processedInput)) {
      throw new Error(
        `Missing required input: ${inputDef.name} for tool ${action.tool}`
      );
    }
  }

  const toolFunc = toolImplementations[action.tool];
  if (!toolFunc) {
    throw new Error(`Implementation not found for tool: ${action.tool}`);
  }

  // Convert input object to ordered arguments based on tool definition
  const args = (toolDef.inputs as ToolInput[]).map(
    (input) => processedInput[input.name] ?? input.default
  );

  return await toolFunc(...args);
}

// Add this helper function at the top with other formatting functions
const formatPrice = (price: TokenPrice, symbol: string) => {
  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: price.current >= 100 ? 2 : 4,
  }).format(price.current);

  const change = price.priceChange24h > 0 ? "+" : "";
  const changePercent = `${change}${price.priceChange24h.toFixed(2)}%`;

  return `${symbol}: ${formattedPrice} (${changePercent})`;
};

const transactionAgent = new TransactionAgent();

async function handleTransactionQuery(query: string, transactionData?: any) {
  try {
    console.log("Handling transaction query:", { query, transactionData });

    // Extract numbers and addresses from the query
    const amountMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:sui|SUI)/i);
    const addressMatch = query.match(/0x[a-fA-F0-9]{64}/);

    console.log("Matches:", { amountMatch, addressMatch });

    if (amountMatch && addressMatch) {
      const amount = parseFloat(amountMatch[1]);
      const recipient = addressMatch[0];
      console.log("Parsed transfer details:", { amount, recipient });

      try {
        // Create transaction immediately
        const transferTx = transactionAgent.buildTransferTx(
          BigInt(amount * 1e9), // Convert SUI to MIST
          recipient
        );
        console.log("Transaction built successfully");

        const estimatedGas = await transactionAgent.estimateGas(transferTx);
        console.log("Gas estimated:", estimatedGas.toString());

        const response = {
          status: "transaction_ready",
          transaction: {
            type: "transfer",
            data: {
              tx: transferTx,
              estimatedGas: estimatedGas.toString(),
            },
          },
          final_answer: `Ready to transfer ${amount} SUI to ${recipient}. Estimated gas: ${estimatedGas} MIST.`,
        };
        console.log("Transfer transaction ready:", response);
        return response;
      } catch (error) {
        console.error("Error building transaction:", error);
        return {
          status: "error",
          error: "Failed to build transaction. Please try again.",
        };
      }
    }

    // If no match found, ask for structured input
    const response = {
      status: "needs_info",
      request:
        "Please provide the transfer details in this format:\n" +
        "transfer <amount> SUI to <wallet-address>\n" +
        "For example: transfer 1 SUI to 0x123...",
      transaction: {
        type: "transfer",
        data: null,
      },
    };
    console.log("Requesting structured input:", response);
    return response;
  } catch (error) {
    console.error("Error in handleTransactionQuery:", error);
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// Update getPriceInfo to handle transaction queries
export async function getPriceInfo(query: string, transactionData?: any) {
  try {
    console.log("getPriceInfo called with:", { query, transactionData });

    // Check if it's a transaction-related query
    const isTransactionQuery =
      query.toLowerCase().includes("transfer") ||
      query.toLowerCase().includes("send") ||
      query.toLowerCase().includes("merge coins") ||
      query.toLowerCase().includes("stake") ||
      query.toLowerCase().includes("staking") ||
      query.toLowerCase().includes("balance") ||
      transactionData;

    console.log("Is transaction query:", isTransactionQuery);

    if (isTransactionQuery) {
      console.log("Routing to handleTransactionQuery");
      return handleTransactionQuery(query, transactionData);
    }

    console.log("Query:", query);
    const message = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 500,
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: createSuiSagePrompt(query),
        },
      ],
    });

    const content =
      message.content[0].type === "text" ? message.content[0].text : "";

    if (!content) {
      throw new Error("No response from Claude");
    }

    console.log("AI Response:", content);

    // Parse the JSON response
    let aiResponse;
    try {
      // First try to parse the entire content
      aiResponse = JSON.parse(content);
    } catch {
      // If that fails, try to extract JSON from markdown code blocks
      const jsonMatch =
        content.match(/```(?:json)?\n([\s\S]*?)\n```/) ||
        content.match(/({[\s\S]*})/);
      if (!jsonMatch) {
        throw new Error("Could not parse AI response");
      }
      aiResponse = JSON.parse(jsonMatch[1].trim());
    }

    console.log("Parsed Response:", aiResponse);

    // Execute actions if they exist, regardless of status
    const results: ActionResult[] = [];
    if (aiResponse.actions && aiResponse.actions.length > 0) {
      for (const action of aiResponse.actions) {
        try {
          const result = await executeAction(action);
          results.push({
            tool: action.tool,
            result,
            action,
          });
        } catch (error) {
          console.error(`Error executing tool ${action.tool}:`, error);
          return {
            status: "error",
            error:
              error instanceof Error ? error.message : "Tool execution failed",
          };
        }
      }

      // Format the results
      let formattedAnswer = "";
      for (const { tool, result, action } of results) {
        switch (tool) {
          case "get_pool_info":
            formattedAnswer = formatPoolInfo(result);
            break;
          case "get_pool_spot_price":
            formattedAnswer = `Spot Price: ${result}`;
            break;
          case "get_token_price":
            const price = result as TokenPrice;
            const symbol = action?.input?.token_type || "Token";
            formattedAnswer = formatPrice(price, symbol);
            break;
          case "get_coins_price_info":
            formattedAnswer = Object.entries(
              result as Record<string, TokenPrice>
            )
              .map(([coin, price]) => formatPrice(price, coin))
              .join("\n");
            break;
          case "get_dca_orders":
            if (!result || (Array.isArray(result) && result.length === 0)) {
              formattedAnswer = "No active DCA orders found for this wallet.";
            } else if (Array.isArray(result)) {
              formattedAnswer = `DCA Orders:\n${result
                .map((order: any, index: number) => {
                  return (
                    `${index + 1}. Order ID: ${order.id}\n` +
                    `   From: ${order.fromCoin}\n` +
                    `   To: ${order.toCoin}\n` +
                    `   Amount: ${order.amount}\n` +
                    `   Frequency: ${order.frequency}`
                  );
                })
                .join("\n\n")}`;
            } else {
              formattedAnswer = "Unexpected DCA orders format received.";
            }
            break;
          case "get_all_pools":
            const pools = result as PoolInfo[];
            const sortBy = action?.input?.sort_by || "tvl";
            const limit = action?.input?.limit || 10;

            const sortedPools = pools
              .sort((a, b) => {
                switch (sortBy) {
                  case "apr":
                    return (b.apr || 0) - (a.apr || 0);
                  case "fees":
                    return (b.fee || 0) - (a.fee || 0);
                  case "tvl":
                  default:
                    return (b.tvl || 0) - (a.tvl || 0);
                }
              })
              .slice(0, limit);

            formattedAnswer = sortedPools
              .map((pool, index) => {
                return `${index + 1}. Pool ${pool.id}
    TVL: $${pool.tvl?.toLocaleString()}
    APR: ${pool.apr?.toFixed(2)}%
    Daily Fees: $${pool.fee?.toLocaleString()}`;
              })
              .join("\n\n");
            break;
          default:
            formattedAnswer = JSON.stringify(result, null, 2);
        }
      }

      // Return the formatted response
      return {
        status: "success",
        reasoning: aiResponse.reasoning,
        results,
        final_answer: formattedAnswer,
      };
    }

    // If no actions but status is success, return the final answer
    if (aiResponse.status === "success") {
      return {
        status: "success",
        reasoning: aiResponse.reasoning,
        final_answer: aiResponse.final_answer,
      };
    }

    // Handle error case
    if (aiResponse.status === "error") {
      return {
        status: "error",
        error: aiResponse.error_message || aiResponse.reasoning,
      };
    }

    // Fallback
    return {
      status: "error",
      error: "Invalid response format",
    };
  } catch (error) {
    console.error("Error in getPriceInfo:", error);
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// Example usage
async function main() {
  // Test different queries
  const queries = [
    "Get me the prices of SUI and USDC",
    "Show me the current prices of SUI, USDC, and BTC",
    "Get information about pool 0x52ac89ee8c446638930f53129803f026a04028d2c0deef314321f71c69ab7f78?",
    "Get fees for pool 0x52ac89ee8c446638930f53129803f026a04028d2c0deef314321f71c69ab7f78",
    "What's the spot price between afSUI and ksui in pool 0x52ac89ee8c446638930f53129803f026a04028d2c0deef314321f71c69ab7f78?",
    "What are the top pools by tvl?",
    "What are the top pools by fees?",
    "What are the top pools by apr?",
    "What are the top pools by volume?",
    "What are the top pools by liquidity?",
    "What are the top pools by reserves?",
    "What are the top pools by token?",
    "What are the top pools by token?",
  ];

  for (const query of queries) {
    console.log("\n-------------------");
    console.log("Query:", query);
    console.log("-------------------");

    const result = await getPriceInfo(query);
    console.log("Result:", JSON.stringify(result, null, 2));
  }
}

// Run the example if this file is run directly
if (require.main === module) {
  main().catch(console.error);
}