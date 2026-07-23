import { Logger } from '@nestjs/common';
import { OracleConfig, OraclePriceResult, OracleProvider, OracleProviderId } from './oracle.types';
import { CoinGeckoProvider } from './providers/coingecko';
import { KrakenProvider } from './providers/kraken';
import { CustomProvider } from './providers/custom';

const logger = new Logger('OracleService');

const VALIDATORS = {
  minPrice: 1,
  maxPrice: 100_000_000,
  maxAgeMs: 5 * 60 * 1000,
};

/**
 * BTC/USD price oracle with caching, fallback chain, and price validation.
 *
 * @description
 * Fetches Bitcoin prices from multiple providers (CoinGecko, Kraken, custom)
 * with automatic caching and fallback. Used by the payment handler to convert
 * fiat amounts to satoshis.
 *
 * @category Services
 */
export class OracleService {
  private cache: OraclePriceResult | null = null;
  private cacheTtlMs: number;
  private providers: Map<OracleProviderId, OracleProvider>;
  private fallbackOrder: OracleProviderId[];

  constructor(config: OracleConfig) {
    this.cacheTtlMs = config.cacheTtlMs ?? 60_000;
    this.fallbackOrder = [config.provider, ...(config.fallbackProviders ?? [])];

    this.providers = new Map();
    this.providers.set('coingecko', new CoinGeckoProvider());
    this.providers.set('kraken', new KrakenProvider());
    if (config.custom) {
      this.providers.set('custom', new CustomProvider(config.custom));
    }

    logger.log(
      `Oracle initialized: provider=${config.provider}, fallback=[${(config.fallbackProviders ?? []).join(', ')}], cacheTtl=${this.cacheTtlMs}ms`,
    );
  }

  async getPrice(): Promise<OraclePriceResult> {
    if (this.isCacheValid()) {
      logger.debug(`Using cached price: $${this.cache!.btcUsd.toLocaleString()} (${this.cache!.provider})`);
      return this.cache!;
    }

    for (const providerId of this.fallbackOrder) {
      const provider = this.providers.get(providerId);
      if (!provider) {
        logger.warn(`Provider "${providerId}" not configured, skipping`);
        continue;
      }

      try {
        const result = await provider.fetchPrice();
        const validated = this.validate(result);
        this.cache = validated;
        logger.log(`Fetched BTC price: $${validated.btcUsd.toLocaleString()} from ${provider.name}`);
        return validated;
      } catch (err: any) {
        logger.error(`Provider ${provider.name} failed: ${err.message}`);
        continue;
      }
    }

    if (this.cache) {
      logger.warn('All providers failed, returning stale cache');
      return this.cache;
    }

    throw new Error('All price oracle providers failed and no cached price available');
  }

  async testProvider(providerId: OracleProviderId): Promise<OraclePriceResult> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    const result = await provider.fetchPrice();
    return this.validate(result);
  }

  private validate(result: OraclePriceResult): OraclePriceResult {
    const { btcUsd, provider } = result;

    if (typeof btcUsd !== 'number' || isNaN(btcUsd)) {
      throw new Error(`Invalid price: ${btcUsd}`);
    }
    if (btcUsd < VALIDATORS.minPrice || btcUsd > VALIDATORS.maxPrice) {
      throw new Error(`Price out of range: $${btcUsd} (expected $${VALIDATORS.minPrice}-$${VALIDATORS.maxPrice})`);
    }
    if (Date.now() - result.timestamp > VALIDATORS.maxAgeMs) {
      throw new Error(`Stale price from ${provider}: ${(Date.now() - result.timestamp) / 1000}s old`);
    }

    return result;
  }

  private isCacheValid(): boolean {
    return this.cache !== null && Date.now() - this.cache.timestamp < this.cacheTtlMs;
  }

  satoshisFromCents(cents: number): number {
    if (!this.cache) {
      throw new Error('No price available - call getPrice() first');
    }
    const dollars = cents / 100;
    const btc = dollars / this.cache.btcUsd;
    const sats = Math.round(btc * 100_000_000);
    return sats;
  }

  clearCache(): void {
    this.cache = null;
  }
}
