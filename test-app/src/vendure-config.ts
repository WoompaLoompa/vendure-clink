import { VendureConfig } from '@vendure/core';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { ClinkPlugin } from 'vendure-plugin-bitcoin-lightning-via-clink';

export const config: VendureConfig = {
  apiOptions: {
    port: 12345,
    cors: {
      origin: '*',
      credentials: true,
    },
    adminApiPath: 'admin-api',
    shopApiPath: 'shop-api',
  },
  authOptions: {
    disableAuth: false,
    superadminCredentials: {
      identifier: 'superadmin',
      password: 'superadmin',
    },
  },
  dbConnectionOptions: {
    type: 'better-sqlite3' as const,
    database: './vendure.sqlite',
    synchronize: true,
  },
  paymentOptions: {
    paymentMethodHandlers: [],
  },
  plugins: [
    AdminUiPlugin.init({
      route: 'admin',
      port: 12345,
    }),
    ClinkPlugin.init({
      relays: ['wss://relay.shocknetwork.com'],
      autoSettle: true,
      offerExpiryMinutes: 30,
      httpFallback: true,
      oracle: {
        provider: 'coingecko',
        cacheTtlMs: 60_000,
        fallbackProviders: ['kraken'],
      },
    }),
  ],
};
