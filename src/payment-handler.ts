import { Logger } from '@nestjs/common';
import {
  PaymentMethodHandler,
  CreatePaymentResult,
  CreatePaymentErrorResult,
  LanguageCode,
  RequestContext,
  Order,
  Payment,
  PaymentMetadata,
} from '@vendure/core';
import { ClinkService } from './services/clink.service';
import { NostrKeyService } from './services/nostr-key.service';
import { ClinkPlugin } from './clink.plugin';

const HANDLER_NAME = 'ClinkPaymentHandler';
const logger = new Logger(HANDLER_NAME);

let clinkService: ClinkService | null = null;
let nostrKeyService: NostrKeyService | null = null;

/**
 * @internal Called by ClinkPlugin to inject services into the payment handler.
 */
export function setClinkServices(
  clink: ClinkService,
  nostr: NostrKeyService,
) {
  clinkService = clink;
  nostrKeyService = nostr;
}

/**
 * Vendure payment handler for Bitcoin Lightning via CLINK protocol.
 *
 * @description
 * Creates CLINK payment offers with BTC price conversion via the oracle.
 * Returns a `Pending` payment state with a `noffer` string for wallet integration.
 *
 * @category PaymentMethodHandler
 */
export const ClinkPaymentHandler = new PaymentMethodHandler({
  code: 'clink-lightning',
  description: [
    {
      languageCode: LanguageCode.en,
      value: 'Bitcoin Lightning (CLINK)',
    },
  ],
  args: {
    relayUrls: {
      type: 'string',
      defaultValue: 'wss://relay.shocknetwork.com',
      label: [{ languageCode: LanguageCode.en, value: 'Nostr Relay URLs' }],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'Comma-separated list of Nostr relay URLs for CLINK offer distribution.',
        },
      ],
    },
    offerExpiryMinutes: {
      type: 'int',
      defaultValue: 30,
      label: [{ languageCode: LanguageCode.en, value: 'Offer Expiry (minutes)' }],
      description: [
        {
          languageCode: LanguageCode.en,
          value: 'How long a CLINK offer remains valid before expiring.',
        },
      ],
    },
  },

  createPayment: async (
    ctx: RequestContext,
    order: Order,
    amount: number,
    args: any,
    metadata: PaymentMetadata,
  ): Promise<CreatePaymentResult | CreatePaymentErrorResult> => {
    try {
      if (!clinkService || !nostrKeyService) {
        throw new Error('CLINK services not initialized');
      }

      const channelId = typeof ctx.channelId === 'string' ? parseInt(ctx.channelId, 10) : ctx.channelId;
      const config = await nostrKeyService.getOrCreateChannelKeys(ctx, channelId);

      const relayUrlsFromArgs = args.relayUrls
        ? args.relayUrls.split(',').map((u: string) => u.trim()).filter(Boolean)
        : config.relayUrls;

      const oracle = ClinkPlugin.getOracleService();
      let amountSats: number;
      try {
        const price = await oracle.getPrice();
        amountSats = oracle.satoshisFromCents(amount);
        logger.log(
          `BTC price: $${price.btcUsd.toLocaleString()} — ${amount} cents = ${amountSats} sats (from ${price.provider})`,
        );
      } catch (oracleErr: any) {
        logger.error(`Oracle failed, cannot convert amount: ${oracleErr.message}`);
        return {
          amount: order.total,
          state: 'Error' as any,
          errorMessage: `Price oracle unavailable: ${oracleErr.message}`,
        };
      }

      const offerId = `vendure_${order.code}_${Date.now()}`;

      const { noffer, offer } = await clinkService.createOffer(
        ctx,
        order.id,
        amountSats,
        offerId,
        { ...config, relayUrls: relayUrlsFromArgs },
      );

      logger.log(`Created CLINK offer ${offerId} for order ${order.code}`);

      return {
        amount: order.total,
        state: 'Pending' as any,
        transactionId: offerId,
        metadata: {
          public: {
            noffer,
            offerId,
            amountSats,
            relayUrls: relayUrlsFromArgs,
          },
          noffer,
          offerId,
        },
      };
    } catch (err: any) {
      logger.error(`Failed to create CLINK payment: ${err.message}`);
      return {
        amount: order.total,
        state: 'Error',
        errorMessage: err.message,
      };
    }
  },

  settlePayment: async (
    ctx: RequestContext,
    order: Order,
    payment: Payment,
    args: any,
  ): Promise<{ success: true }> => {
    if (!clinkService) {
      return { success: true };
    }

    const offerId = payment.transactionId;
    const offer = await clinkService.getOfferById(ctx, offerId);

    if (offer && offer.status === 'paid') {
      return { success: true };
    }

    return { success: true };
  },

  cancelPayment: async (
    ctx: RequestContext,
    order: Order,
    payment: Payment,
    args: any,
  ): Promise<{ success: true }> => {
    if (!clinkService) {
      return { success: true };
    }

    const offerId = payment.transactionId;
    const offer = await clinkService.getOfferById(ctx, offerId);

    if (offer && offer.status === 'pending') {
      await clinkService.markAsExpired(ctx, offer);
      logger.log(`Cancelled CLINK offer ${offerId}`);
    }

    return { success: true };
  },
});
