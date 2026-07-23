import {
  VendureEntity,
  EntityId,
  ID,
  Order,
  DeepPartial,
} from '@vendure/core';
import { Column, Entity, ManyToOne, Index } from 'typeorm';

export type OfferStatus = 'pending' | 'paid' | 'expired' | 'cancelled';
export type PricingType = 0 | 1 | 2;

/**
 * Stores CLINK payment offers associated with orders.
 *
 * @description
 * Each offer contains a Nostr offer string (`noffer`), the amount in satoshis,
 * and tracking fields for payment status, bolt11 invoices, and preimages.
 *
 * @category Entities
 */
@Entity()
export class ClinkOffer extends VendureEntity {
  constructor(input?: DeepPartial<ClinkOffer>) {
    super(input);
  }

  @ManyToOne(() => Order)
  @Index()
  order!: Order;

  @EntityId()
  orderId!: ID;

  @Column({ type: 'varchar', length: 255 })
  @Index({ unique: true })
  offerId!: string;

  @Column({ type: 'text' })
  noffer!: string;

  @Column({ type: 'int', default: 0 })
  amountSats!: number;

  @Column({ type: 'int', default: 0 })
  pricingType!: PricingType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  currency: string | null = null;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  status!: OfferStatus;

  @Column({ type: 'text', nullable: true })
  bolt11Invoice: string | null = null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nostrEventId: string | null = null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  preimage: string | null = null;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date | null = null;

  @Column({ type: 'datetime', nullable: true })
  paidAt: Date | null = null;

  @Column({ type: 'text', nullable: true })
  metadata: string | null = null;
}
