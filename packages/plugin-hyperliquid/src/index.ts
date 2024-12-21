import { Plugin } from "@ai16z/eliza";
import { hyperliquidProvider } from "./providers";

export const hyperliquidPlugin: Plugin = {
    name: "hyperliquid",
    description: "Hyperliquid Plugin for Eliza",
    actions: [],
    evaluators: [],
    providers: [hyperliquidProvider],
};
