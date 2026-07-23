import { ClinkOffer } from './entities/clink-offer.entity';
import { ClinkChannelConfig } from './entities/clink-channel-config.entity';

declare module '@vendure/core/dist/entity/custom-entity-fields' {
  interface CustomOrderFields {
    clinkOffers?: ClinkOffer[];
  }
}

export interface ClinkPaymentMetadata {
  noffer?: string;
  offerId?: string;
  amountSats?: number;
  public?: {
    noffer: string;
    offerId: string;
    amountSats: number;
  };
}
