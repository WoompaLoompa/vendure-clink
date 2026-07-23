import { Injectable, OnApplicationBootstrap, OnApplicationShutdown, Logger } from '@nestjs/common';
import { ProcessContext, TransactionalConnection, RequestContext, EventBus, Channel } from '@vendure/core';
import { ClinkSDK, decodeBech32 } from '@shocknet/clink-sdk';
import { SimplePool, finalizeEvent, getPublicKey, generateSecretKey, verifyEvent } from 'nostr-tools';
import { encryptNip44, decryptNip44 } from './nip44';
import { ClinkChannelConfig } from '../entities/clink-channel-config.entity';
import { ClinkOffer } from '../entities/clink-offer.entity';
import { extractPaymentHashFromBolt11, verifyPreimage } from '../utils/crypto';

const SERVICE_NAME = 'PaymentMonitorService';

@Injectable()
export class PaymentMonitorService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SERVICE_NAME);
  private pool: SimplePool | null = null;
  private subscriptionActive = false;
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private connection: TransactionalConnection,
    private processContext: ProcessContext,
    private eventBus: EventBus,
  ) {}

  async onApplicationBootstrap() {
    if (!this.processContext.isWorker) {
      return;
    }
    this.logger.log('PaymentMonitorService starting (worker context)');
    await this.startListening();
  }

  onApplicationShutdown() {
    this.stopListening();
    this.logger.log('PaymentMonitorService stopped');
  }

  private async startListening() {
    try {
      this.pool = new SimplePool();
      this.subscriptionActive = true;

      this.logger.log('CLINK payment monitor active - listening for Nostr relay events');

      this.monitorExpiredOffers();

      this.logger.log('Payment monitor started successfully');
    } catch (err: any) {
      this.logger.error(`Failed to start payment monitor: ${err.message}`);
    }
  }

  private stopListening() {
    this.subscriptionActive = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.pool) {
      this.pool.close([]);
      this.pool = null;
    }
  }

  private monitorExpiredOffers() {
    this.monitoringInterval = setInterval(async () => {
      if (!this.subscriptionActive) return;

      try {
        const ctx = await this.createSystemContext();
        if (!ctx) return;

        const offerRepo = this.connection.getRepository(ctx, ClinkOffer);
        const pendingOffers = await offerRepo.find({
          where: { status: 'pending' as any },
        });

        const now = new Date();
        for (const offer of pendingOffers) {
          if (offer.expiresAt && new Date(offer.expiresAt) < now) {
            await this.handleOfferExpired(ctx, offer.offerId);
          }
        }
      } catch (err: any) {
        this.logger.error(`Error checking expired offers: ${err.message}`);
      }
    }, 60000);
  }

  async subscribeToRelays(config: ClinkChannelConfig) {
    if (!this.pool || !this.subscriptionActive) return;

    const relays = config.relayUrls;
    if (!relays.length) return;

    try {
      const filter = {
        kinds: [21001 as number],
        '#p': [config.nostrPubkey],
        limit: 100,
      };

      const sub = this.pool.subscribe(relays, filter as any, {
        onevent: (event: any) => {
          this.handleRelayEvent(config, event).catch(err => {
            this.logger.error(`Error handling relay event: ${err.message}`);
          });
        },
      });

      this.logger.log(`Subscribed to ${relays.length} relay(s) for pubkey ${config.nostrPubkey.substring(0, 8)}...`);
    } catch (err: any) {
      this.logger.error(`Failed to subscribe to relays: ${err.message}`);
    }
  }

  private async handleRelayEvent(config: ClinkChannelConfig, event: any) {
    if (!event || !event.content) return;

    try {
      if (!verifyEvent(event)) {
        this.logger.warn(`Invalid Nostr event signature: ${event.id?.substring(0, 8)}...`);
        return;
      }

      const secretKey = config.nostrSecretKey
        ? new Uint8Array(Buffer.from(config.nostrSecretKey, 'hex'))
        : null;

      if (!secretKey) {
        this.logger.warn('No secret key available for decryption');
        return;
      }

      const ctx = await this.createSystemContext();
      if (!ctx) return;

      const decrypted = await this.decryptEventContent(event, secretKey);
      if (!decrypted) return;

      const payload = JSON.parse(decrypted);

      if (payload.bolt11 && payload.res === 'ok') {
        await this.handlePaymentReceiptFromRelay(ctx, config, event, payload);
      }
    } catch (err: any) {
      this.logger.error(`Error processing relay event: ${err.message}`);
    }
  }

  private async decryptEventContent(event: any, secretKey: Uint8Array): Promise<string | null> {
    try {
      const pubkey = getPublicKey(secretKey);
      const tags = event.tags || [];
      const pTag = tags.find((t: any) => t[0] === 'p');
      const senderPubkey = pTag ? pTag[1] : event.pubkey;

      return await decryptNip44(event.content, {
        privkey: Buffer.from(secretKey).toString('hex'),
        pubkey: senderPubkey,
      });
    } catch (err: any) {
      this.logger.error(`Decryption failed: ${err.message}`);
      return null;
    }
  }

  private async handlePaymentReceiptFromRelay(
    ctx: RequestContext,
    config: ClinkChannelConfig,
    event: any,
    payload: any,
  ): Promise<void> {
    const offerId = this.extractOfferIdFromEvent(event);
    if (!offerId) {
      this.logger.warn('Could not extract offer ID from event');
      return;
    }

    const offerRepo = this.connection.getRepository(ctx, ClinkOffer);
    const offer = await offerRepo.findOne({ where: { offerId } });

    if (!offer) {
      this.logger.warn(`Received receipt for unknown offer: ${offerId}`);
      return;
    }

    if (offer.status === 'paid') {
      this.logger.log(`Offer ${offerId} already settled, ignoring receipt`);
      return;
    }

    if (payload.preimage && payload.bolt11) {
      const paymentHash = extractPaymentHashFromBolt11(payload.bolt11);
      if (paymentHash && !verifyPreimage(payload.preimage, paymentHash)) {
        this.logger.warn(
          `Preimage verification failed for offer ${offerId} — sha256(preimage) !== payment_hash`,
        );
        return;
      }
    }

    offer.status = 'paid';
    offer.preimage = payload.preimage;
    offer.bolt11Invoice = payload.bolt11;
    offer.paidAt = new Date();
    offer.nostrEventId = event.id;
    await offerRepo.save(offer);

    this.logger.log(
      `Payment received for offer ${offerId}, ` +
      `preimage: ${payload.preimage?.substring(0, 16)}...`
    );

    await this.sendPaymentReceipt(ctx, config, event.pubkey, event.id);
  }

  private async sendPaymentReceipt(
    ctx: RequestContext,
    config: ClinkChannelConfig,
    payerPubkey: string,
    requestId: string,
  ): Promise<void> {
    if (!this.pool) return;

    try {
      const secretKey = new Uint8Array(Buffer.from(config.nostrSecretKey!, 'hex'));
      const receiptPayload = { res: 'ok' };

      const encrypted = await encryptNip44(
        JSON.stringify(receiptPayload),
        {
          privkey: Buffer.from(secretKey).toString('hex'),
          pubkey: payerPubkey,
        },
      );

      const receiptEvent = finalizeEvent(
        {
          kind: 21001,
          content: encrypted,
          tags: [
            ['p', payerPubkey],
            ['e', requestId],
            ['clink_version', '1'],
          ],
          created_at: Math.floor(Date.now() / 1000),
        },
        secretKey,
      );

      const relays = config.relayUrls;
      await this.pool.publish(relays, receiptEvent as any);

      this.logger.log(`Sent payment receipt for request ${requestId}`);
    } catch (err: any) {
      this.logger.error(`Failed to send payment receipt: ${err.message}`);
    }
  }

  private extractOfferIdFromEvent(event: any): string | null {
    try {
      const tags = event.tags || [];
      const offerTag = tags.find((t: any) => t[0] === 'offer');
      return offerTag ? offerTag[1] : null;
    } catch {
      return null;
    }
  }

  async handlePaymentReceipt(
    ctx: RequestContext,
    offerId: string,
    preimage: string,
    bolt11: string,
  ): Promise<void> {
    const offerRepo = this.connection.getRepository(ctx, ClinkOffer);
    const offer = await offerRepo.findOne({ where: { offerId } });

    if (!offer) {
      this.logger.warn(`Received receipt for unknown offer: ${offerId}`);
      return;
    }

    if (offer.status === 'paid') {
      this.logger.log(`Offer ${offerId} already settled, ignoring receipt`);
      return;
    }

    offer.status = 'paid';
    offer.preimage = preimage;
    offer.bolt11Invoice = bolt11;
    offer.paidAt = new Date();
    await offerRepo.save(offer);

    this.logger.log(
      `Payment received for offer ${offerId}, ` +
      `preimage: ${preimage.substring(0, 16)}...`
    );
  }

  async handleOfferExpired(
    ctx: RequestContext,
    offerId: string,
  ): Promise<void> {
    const offerRepo = this.connection.getRepository(ctx, ClinkOffer);
    const offer = await offerRepo.findOne({ where: { offerId } });

    if (!offer || offer.status !== 'pending') {
      return;
    }

    offer.status = 'expired';
    await offerRepo.save(offer);

    this.logger.log(`Offer ${offerId} expired`);
  }

  private async createSystemContext(): Promise<RequestContext | null> {
    try {
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
    } catch (err: any) {
      this.logger.error(`Failed to create system context: ${err.message}`);
      return null;
    }
  }
}
