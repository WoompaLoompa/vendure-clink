import { CustomOracleConfig, OraclePriceResult, OracleProvider } from '../oracle.types';

function getByPath(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    if (current == null) return undefined;
    if (key === '[]' && Array.isArray(current)) return current[0];
    return current[key];
  }, obj);
}

export class CustomProvider implements OracleProvider {
  id = 'custom' as const;
  name = 'Custom';

  constructor(private config: CustomOracleConfig) {}

  async fetchPrice(): Promise<OraclePriceResult> {
    const { url, method = 'GET', headers = {}, body, pricePath, errorPath } = this.config;

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (body && method === 'POST') {
      fetchOptions.body = body;
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(`Custom oracle HTTP error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (errorPath) {
      const errorValue = getByPath(data, errorPath);
      if (errorValue) {
        throw new Error(`Custom oracle returned error: ${errorValue}`);
      }
    }

    const priceValue = getByPath(data, pricePath);
    if (priceValue == null) {
      throw new Error(`Price path "${pricePath}" not found in response: ${JSON.stringify(data)}`);
    }

    const btcUsd = typeof priceValue === 'string' ? parseFloat(priceValue) : priceValue;
    if (typeof btcUsd !== 'number' || isNaN(btcUsd) || btcUsd <= 0) {
      throw new Error(`Invalid BTC price from custom oracle: ${priceValue}`);
    }

    return {
      btcUsd,
      provider: 'custom',
      timestamp: Date.now(),
      raw: data,
    };
  }
}
