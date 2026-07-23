import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { ClinkService } from '../services/clink.service';

@Resolver()
export class ClinkShopResolver {
  constructor(private clinkService: ClinkService) {}

  @Query()
  @Allow(Permission.Owner)
  async clinkOffer(
    @Ctx() ctx: RequestContext,
    @Args() args: { orderCode: string },
  ) {
    const offer = await this.clinkService.getOfferByOrderCode(ctx, args.orderCode);
    if (!offer) {
      return null;
    }

    const isExpired = offer.expiresAt && new Date(offer.expiresAt) < new Date();
    if (isExpired && offer.status === 'pending') {
      await this.clinkService.markAsExpired(ctx, offer);
      return null;
    }

    return offer;
  }

  @Query()
  @Allow(Permission.Owner)
  async clinkPaymentStatus(
    @Ctx() ctx: RequestContext,
    @Args() args: { orderCode: string },
  ) {
    const offer = await this.clinkService.getOfferByOrderCode(ctx, args.orderCode);
    if (!offer) {
      return null;
    }

    return {
      offerId: offer.offerId,
      status: offer.status,
      bolt11Invoice: offer.bolt11Invoice,
      preimage: offer.preimage,
      noffer: offer.noffer,
      amountSats: offer.amountSats,
    };
  }
}
