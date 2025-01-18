
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

export default async function executeAction(action: any) {
  switch (action.tool) {
    case "get_token_price":
      return await getTokenPrice(action.input.token_type, action.input.network);
      break;
    case "get_coins_price_info":
      return await getCoinsPriceInfo(action.input.coins, action.input.network);
      break;
    case "get_pool_info":
      return await getPool(action.input.pool_id, action.input.network);

    case "get_all_pools":
      return await getAllPools(action.input.network);

    case "get_pool_spot_price":
      return await getPoolSpotPrice(
        action.input.pool_id,
        action.input.coin_in_type,
        action.input.coin_out_type,
        action.input.with_fees,
        action.input.network
      );

    case "get_trade_route":
      return await getTradeRoute(
        action.input.coin_in_type,
        action.input.coin_out_type,
        BigInt(action.input.coin_in_amount),
        action.input.network
      );

    case "get_staking_positions":
      return await getStakingPositions(
        action.input.wallet_address,
        action.input.network
      );

    case "get_dca_orders":
      return await getDcaOrders(
        action.input.wallet_address,
        action.input.network
      );
    default:
      throw new Error(`Unknown tool: ${action.tool}`);
  }
}