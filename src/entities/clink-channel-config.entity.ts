import {
  VendureEntity,
  Channel,
  DeepPartial,
} from '@vendure/core';
import { Column, Entity, ManyToOne, Index } from 'typeorm';

/**
 * Per-channel configuration for the CLINK plugin.
 *
 * @description
 * Stores Nostr keypair, relay URLs, and payment settings for each Vendure channel.
 * Falls back to plugin-level defaults when not configured.
 *
 * @category Entities
 */
@Entity()
export class ClinkChannelConfig extends VendureEntity {
  constructor(input?: DeepPartial<ClinkChannelConfig>) {
    super(input);
  }

  @ManyToOne(() => Channel)
  @Index({ unique: true })
  channel!: Channel;

  @Column({ type: 'varchar', length: 255 })
  nostrPubkey!: string;

  @Column({ type: 'text', nullable: true })
  nostrSecretKey: string | null = null;

  @Column({ type: 'simple-json', default: '[]' })
  relayUrls!: string[];

  @Column({ type: 'boolean', default: true })
  autoSettle!: boolean;

  @Column({ type: 'int', default: 30 })
  offerExpiryMinutes!: number;

  @Column({ type: 'boolean', default: true })
  httpFallback!: boolean;

  @Column({ type: 'varchar', length: 255, default: 'clink-lightning' })
  paymentHandlerCode!: string;
}
