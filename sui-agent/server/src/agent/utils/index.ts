
import { COIN_ADDRESSES } from "../config/config";
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





export{ 
    formatSingleValue
}