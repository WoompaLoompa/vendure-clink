import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ProcessContext, TransactionalConnection, RequestContext, Channel, ID } from '@vendure/core';
import { ClinkSDK, NofferData, NofferResponse, OfferPriceType } from '@shocknet/clink-sdk';
import { generateSecretKey } from 'nostr-tools';
import { ClinkOffer } from '../entities/clink-offer.entity';
import { ClinkChannelConfig } from '../entities/clink-channel-config.entity';
import { ClinkPluginInitOptions, DEFAULT_CLINK_OPTIONS } from '../config/clink-config';

/**
 * Core service for CLINK SDK integration and offer management.
 *
 * @description
 * Manages CLINK SDK instances, creates payment offers, and handles
 * offer lifecycle (status updates, expiry, settlement).
 *
 * @category Services
 */
@Injectable()
export class ClinkService implements OnApplicationBootstrap {
  private readonly logger = new Logger('ClinkService');
  private readonly sdkInstances: Map<string, ClinkSDK> = new Map();

  constructor(
    private connection: TransactionalConnection,
    private processContext: ProcessContext,
  ) {}

  async onApplicationBootstrap() {
    if (this.processContext.isServer) {
      this.logger.log('ClinkService initialized (server context)');
    }
  }

  getOrCreateSDK(config: ClinkChannelConfig): ClinkSDK {
    const key = config.channel.id.toString();
    if (this.sdkInstances.has(key)) {
      return this.sdkInstances.get(key)!;
    }

    const secretKey = config.nostrSecretKey
      ? new Uint8Array(Buffer.from(config.nostrSecretKey, 'hex'))
      : generateSecretKey();

    const sdk = new ClinkSDK({
      privateKey: secretKey,
      relays: config.relayUrls,
      toPubKey: config.nostrPubkey,
    });

    this.sdkInstances.set(key, sdk);
    return sdk;
  }

  async createOffer(
    ctx: RequestContext,
    orderId: ID,
    amountSats: number,
    offerId: string,
    config: ClinkChannelConfig,
  ): Promise<{ noffer: string; offer: ClinkOffer }> {
    const expiryMs = config.offerExpiryMinutes * 60 * 1000;
    const expiresAt = new Date(Date.now() + expiryMs);

    const nofferEncode = (await import('@shocknet/clink-sdk')).nofferEncode;

    const noffer = nofferEncode({
      pubkey: config.nostrPubkey,
      relay: config.relayUrls[0],
      offer: offerId,
      priceType: OfferPriceType.Fixed,
      price: amountSats,
    });

    const offer = await this.connection.getRepository(ctx, ClinkOffer).save(
      new ClinkOffer({
        orderId,
        offerId,
        noffer,
        amountSats,
        pricingType: 0,
        status: 'pending',
        expiresAt,
      }),
    );

    return { noffer, offer };
  }

  async getOfferByOrderCode(
    ctx: RequestContext,
    orderCode: string,
  ): Promise<ClinkOffer | null> {
    return this.connection.getRepository(ctx, ClinkOffer)
      .createQueryBuilder('offer')
      .innerJoin('offer.order', 'order')
      .where('order.code = :code', { code: orderCode })
      .andWhere('offer.status = :status', { status: 'pending' })
      .getOne();
  }

  async getOfferById(
    ctx: RequestContext,
    offerId: string,
  ): Promise<ClinkOffer | null> {
    return this.connection.getRepository(ctx, ClinkOffer).findOne({
      where: { offerId },
    });
  }

  async markAsPaid(
    ctx: RequestContext,
    offer: ClinkOffer,
    preimage: string,
    bolt11: string,
  ): Promise<ClinkOffer> {
    return this.connection.getRepository(ctx, ClinkOffer).save({
      ...offer,
      status: 'paid',
      preimage,
      bolt11Invoice: bolt11,
      paidAt: new Date(),
    });
  }

  async markAsExpired(
    ctx: RequestContext,
    offer: ClinkOffer,
  ): Promise<ClinkOffer> {
    return this.connection.getRepository(ctx, ClinkOffer).save({
      ...offer,
      status: 'expired',
    });
  }

  async getChannelConfig(
    ctx: RequestContext,
    channelId: number,
  ): Promise<ClinkChannelConfig | null> {
    return this.connection.getRepository(ctx, ClinkChannelConfig).findOne({
      where: { channel: { id: channelId } },
    });
  }

  async getConfigOrThrow(
    ctx: RequestContext,
    channelId: number,
  ): Promise<ClinkChannelConfig> {
    const config = await this.getChannelConfig(ctx, channelId);
    if (!config) {
      throw new Error(`No CLINK config found for channel ${channelId}`);
    }
    return config;
  }

  decodeNoffer(noffer: string) {
    return (ClinkSDK as any).decodeBech32(noffer);
  }

  generateOfferId(): string {
    return `vendure_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  async getOffersForOrder(
    ctx: RequestContext,
    orderId: number,
  ): Promise<ClinkOffer[]> {
    return this.connection.getRepository(ctx, ClinkOffer).find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }

  async getAllOffers(
    ctx: RequestContext,
    options?: { status?: string; limit?: number; offset?: number },
  ): Promise<{ items: ClinkOffer[]; totalItems: number }> {
    const qb = this.connection.getRepository(ctx, ClinkOffer)
      .createQueryBuilder('offer')
      .leftJoinAndSelect('offer.order', 'order');

    if (options?.status) {
      qb.andWhere('offer.status = :status', { status: options.status });
    }

    const totalItems = await qb.getCount();
    const items = await qb
      .orderBy('offer.createdAt', 'DESC')
      .skip(options?.offset || 0)
      .take(options?.limit || 50)
      .getMany();

    return { items, totalItems };
  }
}
