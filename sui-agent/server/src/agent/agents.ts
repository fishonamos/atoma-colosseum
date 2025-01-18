import dotenv from "dotenv";
import path from "path";
import { getPriceInfo } from "./utils/getPriceInfo";


dotenv.config({ path: path.resolve(__dirname, "../../.env") });

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
//main().catch((error)=>{console.error("API Error:", error)});
export { getPriceInfo };
