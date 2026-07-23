import { OracleConfig, OracleProviderId, CustomOracleConfig } from '../oracle/oracle.types';

/**
 * Configuration options for the {@link ClinkPlugin}.
 *
 * @category Plugin
 */
export interface ClinkPluginInitOptions {
  /** Nostr relay URLs to connect to for payment notifications. */
  relays: string[];
  /** Whether to automatically settle payments when received (default: true). */
  autoSettle?: boolean;
  /** How long offers remain valid in minutes (default: 30). */
  offerExpiryMinutes?: number;
  /** Whether to enable HTTP webhook fallback (default: true). */
  httpFallback?: boolean;
  /** Static Nostr secret key for the plugin (auto-generated if not provided). */
  nostrSecretKey?: string;
  /**
   * Secret key for HMAC-SHA256 verification of webhook payloads.
   * Required when httpFallback is enabled. Generate with: openssl rand -hex 32
   * @example
   * ```ts
   * ClinkPlugin.init({
   *   webhookSecret: 'your-secret-key-here',
   * })
   * ```
   */
  webhookSecret?: string;
  /** BTC price oracle configuration (default: CoinGecko with Kraken fallback). */
  oracle?: OracleConfig;
}

export const DEFAULT_ORACLE_OPTIONS: OracleConfig = {
  provider: 'coingecko',
  cacheTtlMs: 60_000,
  fallbackProviders: ['kraken'],
};

export const DEFAULT_CLINK_OPTIONS: Required<
  Pick<ClinkPluginInitOptions, 'relays' | 'autoSettle' | 'offerExpiryMinutes' | 'httpFallback' | 'nostrSecretKey' | 'webhookSecret'>
> & { oracle: OracleConfig } = {
  relays: ['wss://relay.shocknetwork.com'],
  autoSettle: true,
  offerExpiryMinutes: 30,
  httpFallback: true,
  nostrSecretKey: '',
  webhookSecret: '',
  oracle: DEFAULT_ORACLE_OPTIONS,
};
