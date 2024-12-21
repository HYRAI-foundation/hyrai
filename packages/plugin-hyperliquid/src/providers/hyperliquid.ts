import { ICacheManager, Memory, State } from "@ai16z/eliza";
import { IAgentRuntime } from "@ai16z/eliza";
import { Provider } from "@ai16z/eliza";
import { Hyperliquid } from "hyperliquid/dist/index.js";
import NodeCache from "node-cache";
import * as path from "path";

export class HL {
    sdk: Hyperliquid;
    private cache: NodeCache;
    private cacheBaseKey: string = "hyperliquid";

    constructor(private cacheManager: ICacheManager, private privateKey: string | null, private walletAddress: string | null) {
        this.sdk = new Hyperliquid(privateKey, false, walletAddress);
        this.cache = new NodeCache({ stdTTL: 60 }); // Cache TTL set to 1 minutes
    }

    private async readFromCache<T>(key: string): Promise<T | null> {
        const cached = await this.cacheManager.get<T>(
            path.join(this.cacheBaseKey, key)
        );
        return cached;
    }

    private async writeToCache<T>(key: string, data: T): Promise<void> {
        await this.cacheManager.set(path.join(this.cacheBaseKey, key), data, {
            expires: Date.now() + 1 * 60 * 1000,
        });
    }

    private async getCachedData<T>(key: string): Promise<T | null> {
        // Check in-memory cache first
        const cachedData = this.cache.get<T>(key);
        if (cachedData) {
            return cachedData;
        }

        // Check file-based cache
        const fileCachedData = await this.readFromCache<T>(key);
        if (fileCachedData) {
            // Populate in-memory cache
            this.cache.set(key, fileCachedData);
            return fileCachedData;
        }

        return null;
    }

    private async setCachedData<T>(cacheKey: string, data: T): Promise<void> {
        // Set in-memory cache
        this.cache.set(cacheKey, data);

        // Write to file-based cache
        await this.writeToCache(cacheKey, data);
    }

    async getAllMids() {
        const cacheKey = `mids`;
        const cachedValue = await this.getCachedData<Awaited<ReturnType<typeof this.sdk.info.getAllMids>>>(cacheKey);

        if (cachedValue) {
            console.log(`Cache hit for ${cacheKey}`);
            return cachedValue;
        }
        console.log(`Cache miss for ${cacheKey}`);

        const data = await this.sdk.info.getAllMids();
        await this.setCachedData(cacheKey, data);
        return data
    }

    async getPerpPortfolio() {
        const cacheKey = `portfolio-perp-${this.walletAddress}`;
        const cachedValue = await this.getCachedData<Awaited<ReturnType<typeof this.sdk.info.perpetuals.getClearinghouseState>>>(cacheKey);

        if (cachedValue) {
            return cachedValue;
        }

        const data = await this.sdk.info.perpetuals.getClearinghouseState(this.walletAddress);
        await this.setCachedData(cacheKey, data);
        return data;
    }

    async getFormattedPortfolio(runtime: IAgentRuntime) {
        try {
            const perpPortfolio = await this.getPerpPortfolio();

            let output = `${runtime.character.name} `;
            output += `Hyperliquid Wallet Address: ${this.walletAddress}\n\n`;

            output += `Perpetuals Account Summary:\n`;
            output += `Perps total equity: ${perpPortfolio.marginSummary.accountValue}\n`;
            output += `Perps total margin used: ${perpPortfolio.marginSummary.totalMarginUsed}\n`;
            output += `Perps total notional position: ${perpPortfolio.marginSummary.totalNtlPos}\n`;
            output += `Perps total raw USD: ${perpPortfolio.marginSummary.totalRawUsd}\n`;
            output += `Widthdrawable USD: ${perpPortfolio.withdrawable}\n\n`;

            if (perpPortfolio.assetPositions.length > 0) {
                output += `Perpetuals Positions:\n`;
            }

            perpPortfolio.assetPositions.forEach(({position, type}) => {
                output += `Asset: ${position.coin}, side: ${(position.szi as unknown as number) <= 0 ? 'SHORT' : 'LONG'}, type: ${type}, size: ${position.szi}, entry price: ${position.entryPx} USD, USD value: ${position.positionValue} USD, liquidation price: ${position.liquidationPx} USD, margin used: ${position.marginUsed} USD, leverage: ${position.leverage.value}, unrealized PNL: ${position.unrealizedPnl} USD, max leverage: ${position.maxLeverage}, funding since open: ${position.cumFunding.sinceOpen} USD\n\n`;
            });

            return output;
        } catch (error) {
            console.error("Error generating portfolio report:", error);
            return "Unable to fetch wallet information. Please try again later.";
        }
    }
}

/*
    Manages Hyperliquid data and provides a context to the agent
*/
export const hyperliquidProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {

        try {
            const privateKey = runtime.getSetting("HYPERLIQUID_PRIVATE_KEY");
            const walletAddress = runtime.getSetting("HYPERLIQUID_WALLET_ADDRESS");

            const hl = new HL(runtime.cacheManager, privateKey, walletAddress);

            let context = '';

            const mids = await hl.getAllMids();
            context += `Hyperliquid assets mid prices: \n${Object.entries(mids).map(([asset, price]) => `${asset}: ${price} USD`).join('\n')}`;

            const portfolio = await hl.getFormattedPortfolio(runtime);
            context += `\n\n${portfolio}`;

            console.log(context);

            return context;
        } catch (error) {
            console.error("Error in Hyperliquid provider:", error);
            return null;
        }
    },
};
