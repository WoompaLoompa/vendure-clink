import { OraclePriceResult, OracleProvider } from '../oracle.types';

export class KrakenProvider implements OracleProvider {
  id = 'kraken' as const;
  name = 'Kraken';

  async fetchPrice(): Promise<OraclePriceResult> {
    const url = 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD';
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Kraken API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      error?: string[];
      result?: Record<string, { c?: [string, string] }>;
    };

    if (data.error && data.error.length > 0) {
      throw new Error(`Kraken API error: ${data.error.join(', ')}`);
    }

    const resultKeys = Object.keys(data.result || {});
    const ticker = resultKeys.length > 0 ? data.result![resultKeys[0]] : undefined;
    const price = ticker?.c?.[0];

    if (!price) {
      throw new Error(`Invalid Kraken response: ${JSON.stringify(data)}`);
    }

    const btcUsd = parseFloat(price);
    if (isNaN(btcUsd) || btcUsd <= 0) {
      throw new Error(`Invalid BTC price from Kraken: ${price}`);
    }

    return {
      btcUsd,
      provider: 'kraken',
      timestamp: Date.now(),
      raw: data,
    };
  }
}
