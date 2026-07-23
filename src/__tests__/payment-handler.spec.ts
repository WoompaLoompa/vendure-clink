jest.mock('../clink.plugin', () => ({
  ClinkPlugin: {
    getOracleService: () => ({
      getPrice: jest.fn().mockResolvedValue({
        btcUsd: 66000,
        provider: 'coingecko',
        timestamp: Date.now(),
      }),
      satoshisFromCents: jest.fn().mockImplementation((cents: number) => {
        return Math.round((cents / 100 / 66000) * 100_000_000);
      }),
    }),
  },
}));

import { ClinkPaymentHandler, setClinkServices } from '../payment-handler';

describe('ClinkPaymentHandler', () => {
  let mockClinkService: any;
  let mockNostrKeyService: any;

  beforeEach(() => {
    mockClinkService = {
      createOffer: jest.fn(),
      getOfferById: jest.fn(),
      markAsExpired: jest.fn(),
    };
    mockNostrKeyService = {
      getOrCreateChannelKeys: jest.fn(),
    };
    setClinkServices(mockClinkService, mockNostrKeyService);
  });

  describe('handler registration', () => {
    it('should have correct code', () => {
      expect(ClinkPaymentHandler.code).toBe('clink-lightning');
    });

    it('should have description', () => {
      expect(ClinkPaymentHandler.description).toEqual([
        { languageCode: 'en', value: 'Bitcoin Lightning (CLINK)' },
      ]);
    });

    it('should have relayUrls arg with default', () => {
      expect(ClinkPaymentHandler.args.relayUrls.type).toBe('string');
      expect(ClinkPaymentHandler.args.relayUrls.defaultValue).toBe('wss://relay.shocknetwork.com');
    });

    it('should have offerExpiryMinutes arg with default', () => {
      expect(ClinkPaymentHandler.args.offerExpiryMinutes.type).toBe('int');
      expect(ClinkPaymentHandler.args.offerExpiryMinutes.defaultValue).toBe(30);
    });
  });

  describe('createPayment', () => {
    it('should create a CLINK offer successfully', async () => {
      const mockConfig = {
        id: 1,
        channel: { id: 1 },
        nostrPubkey: 'test-pubkey',
        relayUrls: ['wss://relay.example.com'],
      };

      mockNostrKeyService.getOrCreateChannelKeys.mockResolvedValue(mockConfig);
      mockClinkService.createOffer.mockResolvedValue({
        noffer: 'noffer1test123',
        offer: { id: 1, offerId: 'test-offer-id' },
      });

      const ctx = { channelId: 1 } as any;
      const order = { id: 1, code: 'ORDER_001', total: 50000000 } as any;

      const result = await (ClinkPaymentHandler as any).createPaymentFn(
        ctx,
        order,
        50000000,
        { relayUrls: 'wss://relay.shocknetwork.com', offerExpiryMinutes: 30 },
        {},
      );

      expect(result.state).toBe('Pending');
      expect(result.transactionId).toMatch(/^vendure_ORDER_001_/);
      expect(result.metadata.public.noffer).toBe('noffer1test123');
      expect(typeof result.metadata.public.amountSats).toBe('number');
    });

    it('should return Error state if services not initialized', async () => {
      setClinkServices(null as any, null as any);

      const ctx = { channelId: 1 } as any;
      const order = { id: 1, code: 'ORDER_002', total: 1000 } as any;

      const result = await (ClinkPaymentHandler as any).createPaymentFn(
        ctx,
        order,
        1000,
        {},
        {},
      );

      expect(result.state).toBe('Error');
      expect(result.errorMessage).toContain('not initialized');

      // Restore for other tests
      setClinkServices(mockClinkService, mockNostrKeyService);
    });

    it('should return Error state on SDK failure', async () => {
      mockNostrKeyService.getOrCreateChannelKeys.mockRejectedValue(
        new Error('Nostr key generation failed'),
      );

      const ctx = { channelId: 1 } as any;
      const order = { id: 1, code: 'ORDER_003', total: 1000 } as any;

      const result = await (ClinkPaymentHandler as any).createPaymentFn(
        ctx,
        order,
        1000,
        {},
        {},
      );

      expect(result.state).toBe('Error');
      expect(result.errorMessage).toBe('Nostr key generation failed');
    });
  });

  describe('settlePayment', () => {
    it('should return success', async () => {
      mockClinkService.getOfferById.mockResolvedValue({
        status: 'paid',
        offerId: 'test-offer',
      });

      const ctx = {} as any;
      const order = {} as any;
      const payment = { transactionId: 'test-offer' } as any;

      const result = await (ClinkPaymentHandler as any).settlePaymentFn(
        ctx,
        order,
        payment,
        {},
      );

      expect(result).toEqual({ success: true });
    });

    it('should return success even if service unavailable', async () => {
      setClinkServices(null as any, null as any);

      const result = await (ClinkPaymentHandler as any).settlePaymentFn(
        {},
        {},
        { transactionId: 'test' },
        {},
      );

      expect(result).toEqual({ success: true });
      setClinkServices(mockClinkService, mockNostrKeyService);
    });
  });

  describe('cancelPayment', () => {
    it('should mark pending offer as expired', async () => {
      mockClinkService.getOfferById.mockResolvedValue({
        status: 'pending',
        offerId: 'test-offer',
      });
      mockClinkService.markAsExpired.mockResolvedValue(undefined);

      const ctx = {} as any;
      const order = {} as any;
      const payment = { transactionId: 'test-offer' } as any;

      const result = await (ClinkPaymentHandler as any).cancelPaymentFn(
        ctx,
        order,
        payment,
        {},
      );

      expect(result).toEqual({ success: true });
      expect(mockClinkService.markAsExpired).toHaveBeenCalled();
    });

    it('should not mark already-paid offer as expired', async () => {
      mockClinkService.getOfferById.mockResolvedValue({
        status: 'paid',
        offerId: 'test-offer',
      });

      const result = await (ClinkPaymentHandler as any).cancelPaymentFn(
        {},
        {},
        { transactionId: 'test-offer' },
        {},
      );

      expect(result).toEqual({ success: true });
      expect(mockClinkService.markAsExpired).not.toHaveBeenCalled();
    });
  });
});
