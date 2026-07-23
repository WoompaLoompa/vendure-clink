jest.mock('@shocknet/clink-sdk', () => ({
  ClinkSDK: jest.fn().mockImplementation(() => ({
    createOffer: jest.fn(),
  })),
  nofferEncode: jest.fn().mockReturnValue('noffer1test'),
  OfferPriceType: { Fixed: 0 },
}));

jest.mock('nostr-tools', () => ({
  generateSecretKey: jest.fn().mockReturnValue(new Uint8Array(32)),
  getPublicKey: jest.fn().mockReturnValue('a'.repeat(64)),
  SimplePool: jest.fn().mockImplementation(() => ({
    subscribe: jest.fn(),
    publish: jest.fn(),
    close: jest.fn(),
  })),
  finalizeEvent: jest.fn().mockReturnValue({ id: 'test', sig: 'test' }),
}));

import { ClinkPaymentHandler } from '../payment-handler';
import { DEFAULT_CLINK_OPTIONS } from '../config/clink-config';

describe('ClinkPlugin', () => {
  describe('ClinkPaymentHandler', () => {
    it('should have correct handler code', () => {
      expect(ClinkPaymentHandler.code).toBe('clink-lightning');
    });

    it('should have createPayment method', () => {
      expect(typeof (ClinkPaymentHandler as any).createPaymentFn).toBe(
        'function',
      );
    });

    it('should have settlePayment method', () => {
      expect(typeof (ClinkPaymentHandler as any).settlePaymentFn).toBe(
        'function',
      );
    });

    it('should have cancelPayment method', () => {
      expect(typeof (ClinkPaymentHandler as any).cancelPaymentFn).toBe(
        'function',
      );
    });
  });

  describe('DEFAULT_CLINK_OPTIONS', () => {
    it('should have correct defaults', () => {
      expect(DEFAULT_CLINK_OPTIONS.relays).toEqual([
        'wss://relay.shocknetwork.com',
      ]);
      expect(DEFAULT_CLINK_OPTIONS.autoSettle).toBe(true);
      expect(DEFAULT_CLINK_OPTIONS.offerExpiryMinutes).toBe(30);
      expect(DEFAULT_CLINK_OPTIONS.httpFallback).toBe(true);
    });
  });
});
