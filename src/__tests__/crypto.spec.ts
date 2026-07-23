import { createHash } from 'crypto';
import {
  verifyPreimage,
  computeHmac,
  verifyHmac,
  extractPaymentHashFromBolt11,
  extractAmountMsatFromBolt11,
} from '../utils/crypto';

describe('Crypto Utilities', () => {
  describe('verifyPreimage', () => {
    it('should verify a valid preimage', () => {
      const preimage = 'a'.repeat(64);
      const preimageBuf = Buffer.from(preimage, 'hex');
      const paymentHash = createHash('sha256').update(preimageBuf).digest('hex');

      expect(verifyPreimage(preimage, paymentHash)).toBe(true);
    });

    it('should reject an invalid preimage', () => {
      const preimage = 'b'.repeat(64);
      const wrongPreimage = 'c'.repeat(64);
      const preimageBuf = Buffer.from(preimage, 'hex');
      const paymentHash = createHash('sha256').update(preimageBuf).digest('hex');

      expect(verifyPreimage(wrongPreimage, paymentHash)).toBe(false);
    });

    it('should reject non-hex preimage', () => {
      expect(verifyPreimage('not-hex', 'a'.repeat(64))).toBe(false);
    });

    it('should reject preimage that is not 32 bytes', () => {
      expect(verifyPreimage('a'.repeat(32), 'a'.repeat(64))).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(verifyPreimage('', '')).toBe(false);
    });
  });

  describe('computeHmac / verifyHmac', () => {
    const secret = 'test-secret-key-12345';
    const payload = JSON.stringify({ offerId: 'test-123', bolt11: 'lnbc1000n1...' });

    it('should compute and verify a valid HMAC', () => {
      const signature = computeHmac(secret, payload);
      expect(verifyHmac(secret, payload, signature)).toBe(true);
    });

    it('should reject invalid signature', () => {
      const signature = computeHmac(secret, payload);
      expect(verifyHmac(secret, payload, 'deadbeef')).toBe(false);
    });

    it('should reject with wrong secret', () => {
      const signature = computeHmac(secret, payload);
      expect(verifyHmac('wrong-secret', payload, signature)).toBe(false);
    });

    it('should reject with tampered payload', () => {
      const signature = computeHmac(secret, payload);
      const tampered = payload.replace('test-123', 'test-999');
      expect(verifyHmac(secret, tampered, signature)).toBe(false);
    });

    it('should produce consistent signatures', () => {
      const sig1 = computeHmac(secret, payload);
      const sig2 = computeHmac(secret, payload);
      expect(sig1).toBe(sig2);
    });
  });

  describe('extractPaymentHashFromBolt11', () => {
    it('should return null for invalid invoice', () => {
      expect(extractPaymentHashFromBolt11('not-a-bolt11')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(extractPaymentHashFromBolt11('')).toBeNull();
    });

    it('should return null for non-lnbc prefix', () => {
      expect(extractPaymentHashFromBolt11('lnbc1')).toBeNull();
    });
  });

  describe('extractAmountMsatFromBolt11', () => {
    it('should return null for invalid invoice', () => {
      expect(extractAmountMsatFromBolt11('not-a-bolt11')).toBeNull();
    });

    it('should return 0 for no-amount invoice', () => {
      expect(extractAmountMsatFromBolt11('lnbc')).toBe(0);
    });
  });
});
