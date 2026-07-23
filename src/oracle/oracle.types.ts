/** Supported oracle provider identifiers. */
export type OracleProviderId = 'coingecko' | 'kraken' | 'custom';

/**
 * Configuration for the BTC price oracle.
 *
 * @category Plugin
 */
export interface OracleConfig {
  /** Primary oracle provider to use. */
  provider: OracleProviderId;
  /** Cache duration in milliseconds (default: 60000). */
  cacheTtlMs?: number;
  /** Fallback providers to try if the primary fails. */
  fallbackProviders?: OracleProviderId[];
  /** Custom provider configuration (required when provider is 'custom'). */
  custom?: CustomOracleConfig;
}

/**
 * Configuration for a custom HTTP-based oracle provider.
 *
 * @category Plugin
 */
export interface CustomOracleConfig {
  /** HTTP endpoint URL to fetch price data. */
  url: string;
  /** HTTP method to use (default: GET). */
  method?: 'GET' | 'POST';
  /** Additional HTTP headers. */
  headers?: Record<string, string>;
  /** Request body for POST requests. */
  body?: string;
  /** JSON path to extract the price value (e.g., 'data.price.usd'). */
  pricePath: string;
  /** JSON path to extract error messages. */
  errorPath?: string;
}

/**
 * Result of a BTC price fetch from an oracle provider.
 *
 * @category Plugin
 */
export interface OraclePriceResult {
  /** Current BTC price in USD. */
  btcUsd: number;
  /** Provider that returned this price. */
  provider: OracleProviderId;
  /** Timestamp of the price fetch. */
  timestamp: number;
  /** Raw response from the provider API. */
  raw: unknown;
}

/**
 * Interface for oracle price providers.
 *
 * @category Plugin
 */
export interface OracleProvider {
  /** Unique identifier for this provider. */
  id: OracleProviderId;
  /** Human-readable name. */
  name: string;
  /** Fetch the current BTC/USD price. */
  fetchPrice(): Promise<OraclePriceResult>;
}
