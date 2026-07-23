# Bitcoin Lightning CLINK Plugin for Vendure

Accept Bitcoin Lightning payments in your Vendure store via the [CLINK protocol](https://github.com/nicokosi/clink) — Nostr-native static payment codes.

## Features

- **CLINK Protocol**: Nostr-native payment codes (noffer format)
- **BTC Price Oracle**: Real-time conversion via CoinGecko, Kraken, or custom providers
- **Per-Channel Config**: Separate Nostr keys and relays per channel
- **HTTP Webhook Fallback**: For wallets without Nostr support
- **Storefront Component**: React component with relay info display

## Quick Start

```bash
npm install vendure-plugin-bitcoin-lightning-via-clink
```

```ts
import { ClinkPlugin } from 'vendure-plugin-bitcoin-lightning-via-clink';

export const config = {
  plugins: [
    ClinkPlugin.init({
      defaultRelays: ['wss://relay.damus.io'],
      network: 'mainnet',
    }),
  ],
};
```

## Documentation

- [Installation](1.-Installation)
- [Configuration](2.-Configuration)
- [Merchant Guide](3.-Merchant-Guide)
- [Customer Guide](4.-Customer-Guide)
- [API Reference](5.-API-Reference)

## Links

- [GitHub Repository](https://github.com/WoompaLoompa/vendure-clink)
- [npm Package](https://www.npmjs.com/package/vendure-plugin-bitcoin-lightning-via-clink)
- [CLINK Protocol](https://github.com/nicokosi/clink)
