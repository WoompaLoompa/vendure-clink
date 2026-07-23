import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ClinkOffer } from './entities/clink-offer.entity';
import { ClinkChannelConfig } from './entities/clink-channel-config.entity';
import { ClinkService } from './services/clink.service';
import { NostrKeyService } from './services/nostr-key.service';
import { PaymentMonitorService } from './services/payment-monitor.service';
import { ClinkShopResolver } from './api/shop.resolver';
import { ClinkAdminResolver } from './api/admin.resolver';
import { ClinkWebhookController } from './api/clink-webhook.controller';
import { shopApiExtensions } from './api/shop-api.extensions';
import { adminApiExtensions } from './api/admin-api.extensions';
import { ClinkPaymentHandler, setClinkServices } from './payment-handler';
import { ClinkPaymentProcess } from './payment-process';
import { OracleService } from './oracle';
import { ClinkPluginInitOptions, DEFAULT_CLINK_OPTIONS } from './config/clink-config';

const PLUGIN_NAME = 'ClinkPlugin';
const logger = new Logger(PLUGIN_NAME);

/**
 * Vendure plugin for accepting Bitcoin Lightning payments via the CLINK protocol.
 *
 * @description
 * This plugin integrates CLINK (Nostr-native static payment codes) with Vendure,
 * enabling Bitcoin Lightning payments with an built-in BTC price oracle.
 *
 * @example
 * ```ts
 * ClinkPlugin.init({
 *   relays: ['wss://relay.shocknetwork.com'],
 *   autoSettle: true,
 *   offerExpiryMinutes: 30,
 *   oracle: {
 *     provider: 'coingecko',
 *     cacheTtlMs: 60000,
 *     fallbackProviders: ['kraken'],
 *   },
 * })
 * ```
 *
 * @category Plugin
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [ClinkOffer, ClinkChannelConfig],
  providers: [ClinkService, NostrKeyService, PaymentMonitorService],
  controllers: [ClinkWebhookController],
  shopApiExtensions: {
    schema: shopApiExtensions,
    resolvers: [ClinkShopResolver],
  },
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [ClinkAdminResolver],
  },
  configuration: config => {
    config.paymentOptions.paymentMethodHandlers.push(ClinkPaymentHandler);
    if (!config.paymentOptions.process) {
      config.paymentOptions.process = [];
    }
    config.paymentOptions.process.push(ClinkPaymentProcess);
    return config;
  },
  compatibility: '^3.0.0',
})
export class ClinkPlugin implements OnApplicationBootstrap {
  private static initOptions: typeof DEFAULT_CLINK_OPTIONS = DEFAULT_CLINK_OPTIONS;
  private static oracleService: OracleService;

  constructor(private moduleRef: ModuleRef) {}

  /**
   * Configure the CLINK plugin with custom options.
   *
   * @param options - Plugin configuration including relays, oracle settings, and payment defaults.
   * @returns The plugin class for use in Vendure config.
   * @category Plugin
   */
  static init(options: ClinkPluginInitOptions) {
    ClinkPlugin.initOptions = { ...DEFAULT_CLINK_OPTIONS, ...options };
    if (options.oracle) {
      ClinkPlugin.initOptions.oracle = { ...DEFAULT_CLINK_OPTIONS.oracle, ...options.oracle } as any;
    }
    return ClinkPlugin;
  }

  static getOracleService(): OracleService {
    return ClinkPlugin.oracleService;
  }

  static getInitOptions(): typeof DEFAULT_CLINK_OPTIONS {
    return ClinkPlugin.initOptions;
  }

  async onApplicationBootstrap() {
    const clinkService = this.moduleRef.get(ClinkService, { strict: false });
    const nostrKeyService = this.moduleRef.get(NostrKeyService, { strict: false });
    setClinkServices(clinkService, nostrKeyService);

    ClinkPlugin.oracleService = new OracleService(ClinkPlugin.initOptions.oracle);

    logger.log(
      `Bitcoin Lightning (CLINK) plugin initialized. ` +
      `Relays: ${ClinkPlugin.initOptions.relays.join(', ')}, ` +
      `Oracle: ${ClinkPlugin.initOptions.oracle.provider}`,
    );

    try {
      const price = await ClinkPlugin.oracleService.getPrice();
      logger.log(`Current BTC price: $${price.btcUsd.toLocaleString()} (from ${price.provider})`);
    } catch (err: any) {
      logger.warn(`Oracle price fetch failed on startup: ${err.message}`);
    }
  }
}
