import { Plugin } from "@ai16z/eliza";
import { hlProvider } from "./providers/hl";

export const hyperliquidPlugin: Plugin = {
    name: "hyperliquid",
    description: "Hyperliquid Plugin for Eliza",
    actions: [
        // continueAction,
        // followRoomAction,
        // unfollowRoomAction,
        // ignoreAction,
        // noneAction,
        // muteRoomAction,
        // unmuteRoomAction,
    ],
    evaluators: [],
    providers: [hlProvider],
};
