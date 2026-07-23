import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Logger, UnauthorizedException } from '@nestjs/common';
import { TransactionalConnection, RequestContext, Channel } from '@vendure/core';
import { ClinkService } from '../services/clink.service';
import { PaymentMonitorService } from '../services/payment-monitor.service';
import { ClinkPlugin } from '../clink.plugin';
import { verifyHmac, verifyPreimage, extractPaymentHashFromBolt11, extractAmountMsatFromBolt11 } from '../utils/crypto';

const CONTROLLER_NAME = 'ClinkWebhookController';

interface PaymentNotification {
  offerId: string;
  bolt11: string;
  preimage: string;
  amount_sats?: number;
  timestamp?: number;
  signature?: string;
}

/**
 * Webhook controller for receiving CLINK payment notifications.
 *
 * @description
 * All endpoints require HMAC-SHA256 signature verification using the plugin's webhookSecret.
 * Preimage verification (sha256(preimage) === payment_hash) is enforced before settling.
 *
 * @category Plugin
 */
@Controller('payments/clink')
export class ClinkWebhookController {
  private readonly logger = new Logger(CONTROLLER_NAME);

  constructor(
    private connection: TransactionalConnection,
    private clinkService: ClinkService,
    private paymentMonitor: PaymentMonitorService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handlePaymentNotification(
    @Body() body: PaymentNotification,
    @Headers('x-clink-signature') signatureHeader: string | undefined,
  ): Promise<{ success: boolean; message?: string }> {
    const config = ClinkPlugin.getInitOptions();

    if (!config.webhookSecret) {
      this.logger.error('webhookSecret not configured — rejecting all webhook requests');
      return { success: false, message: 'Webhook endpoint not configured' };
    }

    if (!signatureHeader) {
      this.logger.warn('Missing x-clink-signature header');
      return { success: false, message: 'Missing signature header' };
    }

    try {
      const payloadStr = JSON.stringify(body);
      if (!verifyHmac(config.webhookSecret, payloadStr, signatureHeader)) {
        this.logger.warn(`Invalid HMAC signature for offer: ${body.offerId}`);
        return { success: false, message: 'Invalid signature' };
      }
    } catch (err: any) {
      this.logger.warn(`Signature verification failed: ${err.message}`);
      return { success: false, message: 'Signature verification failed' };
    }

    const { offerId, bolt11, preimage } = body;

    if (!offerId || !bolt11 || !preimage) {
      this.logger.warn('Invalid payment notification: missing required fields');
      return {
        success: false,
        message: 'Missing required fields: offerId, bolt11, preimage',
      };
    }

    const paymentHash = extractPaymentHashFromBolt11(bolt11);
    if (!paymentHash) {
      this.logger.warn(`Failed to extract payment hash from bolt11 for offer: ${offerId}`);
      return { success: false, message: 'Invalid bolt11 invoice' };
    }

    if (!verifyPreimage(preimage, paymentHash)) {
      this.logger.warn(`Preimage verification failed for offer: ${offerId} — sha256(preimage) !== payment_hash`);
      return { success: false, message: 'Preimage verification failed' };
    }

    const ctx = await this.createSystemContext();

    const offer = await this.clinkService.getOfferById(ctx, offerId);

    if (!offer) {
      this.logger.warn(`Offer not found: ${offerId}`);
      return { success: false, message: `Offer ${offerId} not found` };
    }

    if (offer.status === 'paid') {
      this.logger.log(`Offer ${offerId} already settled`);
      return { success: true, message: 'Payment already settled' };
    }

    if (offer.status !== 'pending') {
      this.logger.warn(`Offer ${offerId} is in unexpected state: ${offer.status}`);
      return {
        success: false,
        message: `Offer is in state ${offer.status}, expected pending`,
      };
    }

    const claimedMsat = extractAmountMsatFromBolt11(bolt11);
    if (claimedMsat !== null && offer.amountSats > 0) {
      const expectedMsat = offer.amountSats * 1000;
      if (claimedMsat !== expectedMsat) {
        this.logger.warn(
          `Amount mismatch for offer ${offerId}: expected ${expectedMsat} msat, got ${claimedMsat} msat`,
        );
        return { success: false, message: 'Amount mismatch' };
      }
    }

    await this.paymentMonitor.handlePaymentReceipt(ctx, offerId, preimage, bolt11);

    this.logger.log(`Payment settled for offer ${offerId}`);

    return {
      success: true,
      message: 'Payment settled successfully',
    };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: any,
    @Headers('x-clink-signature') signatureHeader: string | undefined,
  ): Promise<{ received: boolean }> {
    const config = ClinkPlugin.getInitOptions();

    if (!config.webhookSecret) {
      this.logger.error('webhookSecret not configured — rejecting all webhook requests');
      return { received: false };
    }

    if (!signatureHeader) {
      this.logger.warn('Missing x-clink-signature header on webhook');
      return { received: false };
    }

    try {
      const payloadStr = JSON.stringify(body);
      if (!verifyHmac(config.webhookSecret, payloadStr, signatureHeader)) {
        this.logger.warn('Invalid HMAC signature on webhook');
        return { received: false };
      }
    } catch (err: any) {
      this.logger.warn(`Webhook signature verification failed: ${err.message}`);
      return { received: false };
    }

    try {
      this.logger.log('Received webhook notification');

      if (body.type === 'payment_confirmed' && body.data) {
        const { offerId, bolt11, preimage } = body.data;

        if (offerId && bolt11 && preimage) {
          const paymentHash = extractPaymentHashFromBolt11(bolt11);
          if (!paymentHash) {
            this.logger.warn(`Failed to extract payment hash from bolt11 for offer: ${offerId}`);
            return { received: false };
          }

          if (!verifyPreimage(preimage, paymentHash)) {
            this.logger.warn(`Preimage verification failed for offer: ${offerId}`);
            return { received: false };
          }

          const ctx = await this.createSystemContext();
          await this.paymentMonitor.handlePaymentReceipt(ctx, offerId, preimage, bolt11);
        }
      }

      return { received: true };
    } catch (err: any) {
      this.logger.error(`Error processing webhook: ${err.message}`);
      return { received: false };
    }
  }

  private async createSystemContext(): Promise<RequestContext> {
    const ctx = new RequestContext({
      apiType: 'admin',
      isAuthorized: true,
      authorizedAsOwnerOnly: false,
    } as any);
    const channel = await this.connection.getRepository(ctx, Channel).findOne({ where: { id: 1 } });
    if (channel) {
      (ctx as any).channel = channel;
    }
    return ctx;
  }
}
