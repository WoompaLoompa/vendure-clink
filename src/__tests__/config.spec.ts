import { DEFAULT_CLINK_OPTIONS } from '../config/clink-config';

describe('ClinkPluginInitOptions', () => {
  describe('DEFAULT_CLINK_OPTIONS', () => {
    it('should have default relay URL', () => {
      expect(DEFAULT_CLINK_OPTIONS.relays).toEqual([
        'wss://relay.shocknetwork.com',
      ]);
    });

    it('should have autoSettle enabled', () => {
      expect(DEFAULT_CLINK_OPTIONS.autoSettle).toBe(true);
    });

    it('should have 30 minute expiry', () => {
      expect(DEFAULT_CLINK_OPTIONS.offerExpiryMinutes).toBe(30);
    });

    it('should have httpFallback enabled', () => {
      expect(DEFAULT_CLINK_OPTIONS.httpFallback).toBe(true);
    });

    it('should have empty nostrSecretKey', () => {
      expect(DEFAULT_CLINK_OPTIONS.nostrSecretKey).toBe('');
    });

    it('should have empty webhookSecret', () => {
      expect(DEFAULT_CLINK_OPTIONS.webhookSecret).toBe('');
    });
  });
});
