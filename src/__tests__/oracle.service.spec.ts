import { OracleService } from '../oracle/oracle.service';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('OracleService', () => {
  let oracle: OracleService;

  beforeEach(() => {
    mockFetch.mockReset();
    oracle = new OracleService({
      provider: 'coingecko',
      cacheTtlMs: 60_000,
      fallbackProviders: ['kraken'],
    });
  });

  describe('getPrice', () => {
    it('should fetch price from CoinGecko', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ bitcoin: { usd: 65000 } }),
      });

      const result = await oracle.getPrice();
      expect(result.btcUsd).toBe(65000);
      expect(result.provider).toBe('coingecko');
    });

    it('should use cached price within TTL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ bitcoin: { usd: 65000 } }),
      });

      await oracle.getPrice();
      await oracle.getPrice();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should fallback to Kraken on CoinGecko failure', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('CoinGecko down'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            error: [],
            result: { XXBTZUSD: { c: ['66000.00', '1'] } },
          }),
        });

      const result = await oracle.getPrice();
      expect(result.btcUsd).toBe(66000);
      expect(result.provider).toBe('kraken');
    });

    it('should throw if all providers fail', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(oracle.getPrice()).rejects.toThrow('All price oracle providers failed');
    });

    it('should return stale cache if all providers fail', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ bitcoin: { usd: 65000 } }),
      });
      await oracle.getPrice();

      mockFetch.mockRejectedValue(new Error('Network error'));
      const result = await oracle.getPrice();
      expect(result.btcUsd).toBe(65000);
    });
  });

  describe('testProvider', () => {
    it('should test CoinGecko provider', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ bitcoin: { usd: 65000 } }),
      });

      const result = await oracle.testProvider('coingecko');
      expect(result.btcUsd).toBe(65000);
    });

    it('should test Kraken provider', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          error: [],
          result: { XXBTZUSD: { c: ['66000.00', '1'] } },
        }),
      });

      const result = await oracle.testProvider('kraken');
      expect(result.btcUsd).toBe(66000);
    });

    it('should throw for unknown provider', async () => {
      await expect(oracle.testProvider('unknown' as any)).rejects.toThrow('Unknown provider');
    });
  });

  describe('satoshisFromCents', () => {
    it('should convert cents to sats correctly', () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ bitcoin: { usd: 60000 } }),
      });

      return oracle.getPrice().then(() => {
        const sats = oracle.satoshisFromCents(500);
        // $5.00 / $60,000 = 0.00008333 BTC = 8333 sats
        expect(sats).toBe(8333);
      });
    });

    it('should throw if no price available', () => {
      expect(() => oracle.satoshisFromCents(500)).toThrow('No price available');
    });
  });

  describe('validation', () => {
    it('should reject negative prices', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ bitcoin: { usd: -100 } }),
      });

      await expect(oracle.testProvider('coingecko')).rejects.toThrow('Invalid BTC price');
    });

    it('should reject zero prices', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ bitcoin: { usd: 0 } }),
      });

      await expect(oracle.testProvider('coingecko')).rejects.toThrow('Invalid BTC price');
    });

    it('should reject absurdly high prices', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ bitcoin: { usd: 200_000_000 } }),
      });

      await expect(oracle.testProvider('coingecko')).rejects.toThrow('Price out of range');
    });
  });

  describe('custom provider', () => {
    it('should fetch from custom URL with JSON path', async () => {
      const customOracle = new OracleService({
        provider: 'custom',
        cacheTtlMs: 60_000,
        custom: {
          url: 'https://api.example.com/btc-price',
          pricePath: 'data.price.usd',
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { price: { usd: 70000 } } }),
      });

      const result = await customOracle.testProvider('custom');
      expect(result.btcUsd).toBe(70000);
    });

    it('should throw if price path not found', async () => {
      const customOracle = new OracleService({
        provider: 'custom',
        cacheTtlMs: 60_000,
        custom: {
          url: 'https://api.example.com/btc-price',
          pricePath: 'data.nonexistent',
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { price: { usd: 70000 } } }),
      });

      await expect(customOracle.testProvider('custom')).rejects.toThrow('not found');
    });
  });

  describe('clearCache', () => {
    it('should clear cache and fetch fresh price', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ bitcoin: { usd: 65000 } }),
      });

      await oracle.getPrice();
      oracle.clearCache();

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ bitcoin: { usd: 70000 } }),
      });

      const result = await oracle.getPrice();
      expect(result.btcUsd).toBe(70000);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
