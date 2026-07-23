import { createHash, createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies that sha256(preimage) === paymentHash.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @category Utilities
 */
export function verifyPreimage(preimage: string, paymentHash: string): boolean {
  try {
    const preimageBuf = Buffer.from(preimage, 'hex');
    if (preimageBuf.length !== 32) return false;

    const computedHash = createHash('sha256').update(preimageBuf).digest('hex');
    const expectedBuf = Buffer.from(paymentHash, 'hex');
    const computedBuf = Buffer.from(computedHash, 'hex');

    if (expectedBuf.length !== computedBuf.length) return false;
    return timingSafeEqual(expectedBuf, computedBuf);
  } catch {
    return false;
  }
}

/**
 * Computes HMAC-SHA256 signature of a payload using a shared secret.
 *
 * @category Utilities
 */
export function computeHmac(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

/**
 * Verifies that an HMAC-SHA256 signature matches the expected value.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @category Utilities
 */
export function verifyHmac(secret: string, payload: string, signature: string): boolean {
  const expected = computeHmac(secret, payload);
  try {
    const expectedBuf = Buffer.from(expected, 'hex');
    const sigBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== sigBuf.length) return false;
    return timingSafeEqual(expectedBuf, sigBuf);
  } catch {
    return false;
  }
}

/**
 * Extracts the payment hash (tag `p`) from a BOLT11 invoice.
 * Minimal decoder — only extracts tagged fields, does not validate signature.
 *
 * @category Utilities
 */
export function extractPaymentHashFromBolt11(bolt11: string): string | null {
  try {
    const lower = bolt11.toLowerCase();
    const prefix = lower.startsWith('lnbc') ? 'lnbc' : lower.startsWith('lntb') ? 'lntb' : lower.startsWith('lnbcrt') ? 'lnbcrt' : null;
    if (!prefix) return null;

    const dataWithSig = lower.slice(prefix.length);
    const multipliers: Record<string, number> = { p: 1e-12, n: 1e-9, u: 1e-6, m: 1e-3, '': 1 };

    let pos = 0;
    while (pos < dataWithSig.length && '0123456789'.includes(dataWithSig[pos])) pos++;
    pos++;

    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const dataChars = dataWithSig.slice(pos);

    const data: number[] = [];
    for (const ch of dataChars) {
      const idx = CHARSET.indexOf(ch);
      if (idx === -1) break;
      data.push(idx);
    }

    const type5bits = data.slice(0, 7);
    let value = 0;
    for (const b of type5bits) {
      value = (value << 5) | b;
    }
    const type = value >> 5;
    const len5bits = ((value & 0x1f) << 2) | (data[7] >> 3);
    const dataStart = 7 + 1;

    if (type === 1 && len5bits >= 52) {
      const hashData = data.slice(dataStart, dataStart + 52);
      const bytes: number[] = [];
      for (let i = 0; i < 52; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8 && i + j < 52; j++) {
          byte = (byte << 5) | (hashData[i + j] || 0);
        }
        bytes.push((byte >> 3) & 0xff);
        if (i + 8 <= 52) {
          const nextByte = ((hashData[i + 7] || 0) & 0x07) << 5;
          if (i + 8 < 52) {
            bytes[bytes.length - 1] = bytes[bytes.length - 1];
          }
        }
      }

      const hexChars = '0123456789abcdef';
      let hex = '';
      for (let i = 0; i < 32 && i < bytes.length; i++) {
        hex += hexChars[(bytes[i] >> 4) & 0xf] + hexChars[bytes[i] & 0xf];
      }
      if (hex.length === 64) return hex;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts the payment amount in millisatoshis from a BOLT11 invoice.
 *
 * @category Utilities
 */
export function extractAmountMsatFromBolt11(bolt11: string): number | null {
  try {
    const lower = bolt11.toLowerCase();
    let prefix: string | null = null;
    if (lower.startsWith('lnbcrt')) prefix = 'lnbcrt';
    else if (lower.startsWith('lnbc')) prefix = 'lnbc';
    else if (lower.startsWith('lntb')) prefix = 'lntb';
    if (!prefix) return null;

    const afterPrefix = lower.slice(prefix.length);
    let amountStr = '';
    let pos = 0;
    while (pos < afterPrefix.length && '0123456789'.includes(afterPrefix[pos])) {
      amountStr += afterPrefix[pos];
      pos++;
    }
    if (!amountStr) return 0;

    const multiplierChar = afterPrefix[pos] || '';
    const multipliers: Record<string, number> = {
      p: 1e-12,
      n: 1e-9,
      u: 1e-6,
      m: 1e-3,
      '': 1,
    };
    const multiplier = multipliers[multiplierChar] ?? 1;
    const amountBtc = parseFloat(amountStr) * multiplier;
    return Math.round(amountBtc * 1e11);
  } catch {
    return null;
  }
}
