import { Injectable, Logger } from '@nestjs/common';
import { TransactionalConnection, RequestContext, Channel } from '@vendure/core';
import { getPublicKey, generateSecretKey } from 'nostr-tools';
import { ClinkChannelConfig } from '../entities/clink-channel-config.entity';

/**
 * Manages Nostr keypair generation and per-channel configuration.
 *
 * @description
 * Generates Nostr keypairs for CLINK offer signing and manages
 * per-channel configuration storage in the database.
 *
 * @category Services
 */
@Injectable()
export class NostrKeyService {
  private readonly logger = new Logger('NostrKeyService');

  constructor(private connection: TransactionalConnection) {}

  generateKeyPair(): { secretKey: Uint8Array; pubkey: string } {
    const secretKey = generateSecretKey();
    const pubkey = getPublicKey(secretKey);
    return { secretKey, pubkey };
  }

  getPubkeyFromSecretKey(secretKeyHex: string): string {
    const secretKey = new Uint8Array(Buffer.from(secretKeyHex, 'hex'));
    return getPublicKey(secretKey);
  }

  async getOrCreateChannelKeys(
    ctx: RequestContext,
    channelId: number,
  ): Promise<ClinkChannelConfig> {
    const repo = this.connection.getRepository(ctx, ClinkChannelConfig);
    let config = await repo.findOne({
      where: { channel: { id: channelId } },
    });

    if (!config) {
      const keys = this.generateKeyPair();
      config = await repo.save(
        new ClinkChannelConfig({
          channel: { id: channelId } as Channel,
          nostrPubkey: keys.pubkey,
          nostrSecretKey: Buffer.from(keys.secretKey).toString('hex'),
          relayUrls: ['wss://relay.shocknetwork.com'],
          autoSettle: true,
          offerExpiryMinutes: 30,
          httpFallback: true,
        }),
      );
      this.logger.log(
        `Generated new Nostr keypair for channel ${channelId}: ${keys.pubkey}`,
      );
    }

    return config;
  }

  async updateConfig(
    ctx: RequestContext,
    channelId: number,
    updates: Partial<Pick<ClinkChannelConfig, 'relayUrls' | 'autoSettle' | 'offerExpiryMinutes' | 'httpFallback'>>,
  ): Promise<ClinkChannelConfig> {
    const config = await this.getOrCreateChannelKeys(ctx, channelId);
    return this.connection.getRepository(ctx, ClinkChannelConfig).save({
      ...config,
      ...updates,
    });
  }

  secretKeyToPubkey(secretKeyHex: string): string {
    return this.getPubkeyFromSecretKey(secretKeyHex);
  }
}
