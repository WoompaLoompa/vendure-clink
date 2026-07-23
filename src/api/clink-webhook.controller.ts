import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { TransactionalConnection, RequestContext, Channel } from '@vendure/core';
import { ClinkService } from '../services/clink.service';
import { PaymentMonitorService } from '../services/payment-monitor.service';

const CONTROLLER_NAME = 'ClinkWebhookController';

interface PaymentNotification {
  offerId: string;
  bolt11: string;
  preimage: string;
  amount_sats?: number;
  timestamp?: number;
}

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
  ): Promise<{ success: boolean; message?: string }> {
    try {
      this.logger.log(`Received payment notification for offer: ${body.offerId}`);

      const { offerId, bolt11, preimage } = body;

      if (!offerId || !bolt11 || !preimage) {
        this.logger.warn('Invalid payment notification: missing required fields');
        return {
          success: false,
          message: 'Missing required fields: offerId, bolt11, preimage',
        };
      }

      const ctx = await this.createSystemContext();

      const offer = await this.clinkService.getOfferById(ctx, offerId);

      if (!offer) {
        this.logger.warn(`Offer not found: ${offerId}`);
        return {
          success: false,
          message: `Offer ${offerId} not found`,
        };
      }

      if (offer.status === 'paid') {
        this.logger.log(`Offer ${offerId} already settled`);
        return {
          success: true,
          message: 'Payment already settled',
        };
      }

      if (offer.status !== 'pending') {
        this.logger.warn(`Offer ${offerId} is in unexpected state: ${offer.status}`);
        return {
          success: false,
          message: `Offer is in state ${offer.status}, expected pending`,
        };
      }

      await this.paymentMonitor.handlePaymentReceipt(ctx, offerId, preimage, bolt11);

      this.logger.log(`Payment settled for offer ${offerId}`);

      return {
        success: true,
        message: 'Payment settled successfully',
      };
    } catch (err: any) {
      this.logger.error(`Error processing payment notification: ${err.message}`);
      return {
        success: false,
        message: 'Internal server error',
      };
    }
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: any,
  ): Promise<{ received: boolean }> {
    try {
      this.logger.log('Received webhook notification');

      if (body.type === 'payment_confirmed' && body.data) {
        const { offerId, bolt11, preimage } = body.data;

        if (offerId && bolt11 && preimage) {
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
