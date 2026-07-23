import { OraclePriceResult, OracleProvider } from '../oracle.types';

export class CoinGeckoProvider implements OracleProvider {
  id = 'coingecko' as const;
  name = 'CoinGecko';

  private baseUrl = 'https://api.coingecko.com/api/v3';

  async fetchPrice(): Promise<OraclePriceResult> {
    const url = `${this.baseUrl}/simple/price?ids=bitcoin&vs_currencies=usd`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { bitcoin?: { usd?: number } };
    const btcUsd = data?.bitcoin?.usd;

    if (btcUsd == null || typeof btcUsd !== 'number' || btcUsd <= 0) {
      throw new Error(`Invalid BTC price from CoinGecko: ${JSON.stringify(data)}`);
    }

    return {
      btcUsd,
      provider: 'coingecko',
      timestamp: Date.now(),
      raw: data,
    };
  }
}
