import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { ClinkService } from '../services/clink.service';
import { NostrKeyService } from '../services/nostr-key.service';
import { ClinkPlugin } from '../clink.plugin';
import { OracleProviderId } from '../oracle/oracle.types';

@Resolver()
export class ClinkAdminResolver {
  constructor(
    private clinkService: ClinkService,
    private nostrKeyService: NostrKeyService,
  ) {}

  @Query()
  @Allow(Permission.ReadAdministrator)
  async clinkConfig(
    @Ctx() ctx: RequestContext,
    @Args() args: { channelId: string },
  ) {
    return this.nostrKeyService.getOrCreateChannelKeys(
      ctx,
      parseInt(args.channelId, 10),
    );
  }

  @Query()
  @Allow(Permission.ReadAdministrator)
  async clinkOffers(
    @Ctx() ctx: RequestContext,
    @Args() args: { status?: string; limit?: number; offset?: number },
  ) {
    return this.clinkService.getAllOffers(ctx, {
      status: args.status,
      limit: args.limit,
      offset: args.offset,
    });
  }

  @Query()
  @Allow(Permission.ReadAdministrator)
  async oraclePrice() {
    const oracle = ClinkPlugin.getOracleService();
    const result = await oracle.getPrice();
    return {
      btcUsd: result.btcUsd,
      provider: result.provider,
      timestamp: new Date(result.timestamp).toISOString(),
    };
  }

  @Mutation()
  @Allow(Permission.ReadAdministrator)
  async testOraclePrice(
    @Args() args: { provider: string },
  ) {
    const oracle = ClinkPlugin.getOracleService();
    const providerId = args.provider as OracleProviderId;

    try {
      const result = await oracle.testProvider(providerId);
      return {
        success: true,
        provider: result.provider,
        price: {
          btcUsd: result.btcUsd,
          provider: result.provider,
          timestamp: new Date(result.timestamp).toISOString(),
        },
      };
    } catch (err: any) {
      return {
        success: false,
        provider: providerId,
        price: null,
        error: err.message,
      };
    }
  }

  @Mutation()
  @Allow(Permission.ReadAdministrator)
  async updateClinkConfig(
    @Ctx() ctx: RequestContext,
    @Args() args: { channelId: string; input: any },
  ) {
    return this.nostrKeyService.updateConfig(
      ctx,
      parseInt(args.channelId, 10),
      args.input,
    );
  }
}
