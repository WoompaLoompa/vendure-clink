# vendure-plugin-bitcoin-lightning-via-clink

[![npm version](https://img.shields.io/npm/v/vendure-plugin-bitcoin-lightning-via-clink.svg)](https://www.npmjs.com/package/vendure-plugin-bitcoin-lightning-via-clink) 
[![Vendure](https://img.shields.io/badge/Vendure-v3.x-blue)](https://www.vendure.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0) 
[![CLINK](https://img.shields.io/badge/Protocol-CLINK-orange.svg)](https://clinkme.dev)

**Bitcoin Lightning payments for [Vendure](https://www.vendure.io/) via the [CLINK](https://clinkme.dev) protocol — Nostr-native static payment codes.**

Accept Bitcoin Lightning payments in your Vendure store using CLINK (`noffer1...`) static payment codes. Customers pay directly from any CLINK-compatible wallet — no invoices to generate, no payment pages to build.

---

## Features

- **CLINK Protocol** — Nostr-native static payment codes (`noffer1...` bech32 strings)
- **Nostr Relay Integration** — Real-time payment monitoring via Kind 21001 events
- **NIP-44 Encryption** — End-to-end encrypted payment communication
- **Per-Channel Config** — Each Vendure channel gets its own Nostr keypair and relay config
- **HTTP Webhook Fallback** — `POST /payments/clink` for wallets without Nostr support
- **GraphQL API** — Shop API for storefronts, Admin API for management
- **Storefront React Component** — Ready-to-use `ClinkPayment` component with QR display
- **Auto-Expiry** — Configurable payment offer expiration
- **Zero Invoice Generation** — Static offers eliminate per-payment invoice creation

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Vendure Server                     │
│                                                       │
│  ┌──────────────┐    ┌─────────────────────────────┐ │
│  │  Shop API     │    │  Admin API                  │ │
│  │  clinkOffer   │    │  clinkConfig                │ │
│  │  clinkPayment │    │  clinkOffers                │ │
│  │  Status       │    │  updateClinkConfig          │ │
│  └──────┬───────┘    └──────────┬──────────────────┘ │
│         │                       │                     │
│  ┌──────▼───────────────────────▼──────────────────┐ │
│  │              ClinkPlugin                        │ │
│  │  ┌─────────────┐  ┌──────────────────────────┐  │ │
│  │  │ ClinkService │  │ PaymentMonitorService    │  │ │
│  │  │ - createOffer│  │ - Nostr relay listener   │  │ │
│  │  │ - getOffer   │  │ - NIP-44 decrypt/encrypt │  │ │
│  │  │ - markPaid   │  │ - Receipt handler        │  │ │
│  │  └──────┬──────┘  └────────────┬─────────────┘  │ │
│  │         │                      │                  │ │
│  │  ┌──────▼──────────────────────▼──────────────┐  │ │
│  │  │        ClinkPaymentHandler                 │  │ │
│  │  │  code: "clink-lightning"                   │  │ │
│  │  │  createPayment → ClinkOffer (noffer1...)   │  │ │
│  │  │  settlePayment → verify Nostr receipt      │  │ │
│  │  │  cancelPayment → mark offer expired        │  │ │
│  │  └────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────┘ │
│         │                                            │
│  ┌──────▼──────────────────────────────────────────┐ │
│  │            CLINK SDK (@shocknet/clink-sdk)      │ │
│  │  nofferEncode() → noffer1... bech32 string      │ │
│  │  ClinkSDK → Nostr relay communication           │ │
│  └─────────────────────────────────────────────────┘ │
└───────────────────────┬─────────────────────────────┘
                        │
         ┌──────────────▼──────────────┐
         │     Nostr Relay Network     │
         │  - Kind 21001 events        │
         │  - NIP-44 encrypted msgs    │
         │  - Payment confirmations    │
         └──────────────┬──────────────┘
                        │
         ┌──────────────▼──────────────┐
         │   CLINK-Compatible Wallet   │
         │   ShockWallet, ZEUS, etc.   │
         │   Scans noffer → Pays LN    │
         └─────────────────────────────┘
```

---

## Quick Start

### 1. Install

```bash
npm install vendure-plugin-bitcoin-lightning-via-clink
```

### 2. Configure

```typescript
// vendure-config.ts
import { ClinkPlugin } from 'vendure-plugin-bitcoin-lightning-via-clink';

export const config: VendureConfig = {
  plugins: [
    ClinkPlugin.init({
      relays: ['wss://relay.shocknetwork.com'],
      autoSettle: true,
      offerExpiryMinutes: 30,
      httpFallback: true,
    }),
  ],
  // ... rest of config
};
```

### 3. Add Payment Method

In the Vendure Admin UI, go to **Settings > Payment Methods** and add **Bitcoin Lightning (CLINK)**.

### 4. Accept Payments

Customers can now select CLINK at checkout and pay from any compatible wallet.

---

## Plugin Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `relays` | `string[]` | `['wss://relay.shocknetwork.com']` | Nostr relay URLs |
| `autoSettle` | `boolean` | `true` | Auto-confirm payments when Nostr receipt received |
| `offerExpiryMinutes` | `number` | `30` | Minutes before payment offer expires |
| `httpFallback` | `boolean` | `true` | Enable HTTP webhook at `/payments/clink` |
| `nostrSecretKey` | `string` | `''` | Global Nostr key (hex). Per-channel keys generated if empty |

---

## GraphQL API

### Shop API (Customer-Facing)

```graphql
# Get CLINK offer for an order
query {
  clinkOffer(orderCode: "ORDER_001") {
    offerId
    noffer          # noffer1... bech32 string for wallet
    amountSats
    status
    expiresAt
  }
}

# Check payment status
query {
  clinkPaymentStatus(orderCode: "ORDER_001") {
    offerId
    status          # pending | paid | expired
    preimage        # Payment proof (available after settlement)
    bolt11Invoice
  }
}
```

### Admin API

```graphql
# Get channel CLINK config
query {
  clinkConfig(channelId: "1") {
    nostrPubkey
    relayUrls
    autoSettle
    offerExpiryMinutes
  }
}

# List all offers
query {
  clinkOffers(status: "pending", limit: 20) {
    totalItems
    items {
      offerId
      noffer
      amountSats
      status
      paidAt
    }
  }
}

# Update channel config
mutation {
  updateClinkConfig(
    channelId: "1",
    input: {
      relayUrls: ["wss://relay.shocknetwork.com"]
      autoSettle: true
      offerExpiryMinutes: 60
    }
  ) {
    nostrPubkey
    relayUrls
  }
}
```

---

## Storefront Integration

### React Component

```tsx
import { ClinkPayment } from './ClinkPayment';

function CheckoutPage({ orderCode }: { orderCode: string }) {
  return (
    <ClinkPayment
      orderCode={orderCode}
      apiEndpoint="https://your-store.com/shop-api"
      onPaymentConfirmed={(preimage) => {
        console.log('Payment confirmed!', preimage);
        // Redirect to order confirmation
      }}
      onPaymentExpired={() => {
        console.log('Payment expired');
        // Show retry option
      }}
    />
  );
}
```

### Using Vendure's `addPaymentToOrder` Mutation

```graphql
mutation AddClinkPayment {
  addPaymentToOrder(
    input: {
      method: "clink-lightning"
      metadata: {}
    }
  ) {
    ... on Order {
      id
      code
      total
      state
    }
    ... on ErrorResult {
      errorCode
      message
    }
  }
}
```

---

## HTTP Webhook

For wallets without Nostr support, the HTTP fallback accepts:

```
POST /payments/clink
Content-Type: application/json

{
  "offerId": "vendure_ORDER_001_1234567890",
  "bolt11": "lnbc1...",
  "preimage": "hex_preimage"
}
```

---

## Database Tables

The plugin creates two tables automatically:

- **`clink_offer`** — Payment offers linked to Vendure orders
- **`clink_channel_config`** — Per-channel Nostr keys and relay configuration

---

## Development

### Test App

```bash
# Build plugin and copy to test-app
npm run dev:test-app

# Start test Vendure server
cd test-app && npm run dev
```

Server runs at `http://localhost:3000`:
- Shop API: `http://localhost:3000/shop-api`
- Admin API: `http://localhost:3000/admin-api`

### Build

```bash
npm run build          # Compile TypeScript
npm run typecheck      # Type-check without emitting
npm run dev            # Watch mode
```

---

## How CLINK Works

1. **Merchant** configures CLINK plugin with Nostr relay URLs
2. **Customer** adds item to cart and proceeds to checkout
3. **Plugin** generates a `noffer1...` static payment code linked to the order
4. **Customer** scans/pastes the offer in a CLINK-compatible wallet
5. **Wallet** resolves the offer via Nostr relay and pays the Lightning invoice
6. **Nostr relay** forwards payment receipt (Kind 21001, NIP-44 encrypted)
7. **Plugin** decrypts receipt, verifies payment, marks offer as paid
8. **Order** advances to the next state

### Key Concepts

- **`noffer1...`**: Bech32-encoded static payment code (like a Lightning address, but for offers)
- **Nostr Kind 21001**: CLINK protocol event type for payment communication
- **NIP-44**: Nostr encryption standard for end-to-end encrypted payment messages
- **Per-channel keys**: Each Vendure channel gets its own Nostr identity

---

## License

GPL v3

---

## Links

- [CLINK Protocol](https://clinkme.dev) — Official CLINK documentation
- [Vendure](https://www.vendure.io/) — eCommerce platform
- [Nostr](https://nostr.com/) — Decentralized protocol
- [ShockNet](https://github.com/ShockNet) — Bitcoin Lightning infrastructure

## Conversations
- In this repo: https://github.com/WoompaLoompa/vendure-clink/discussions
- In Vendure GH forum: https://github.com/vendurehq/vendure/discussions/5019
- In Vendure Discord: https://discord.com/channels/1100672177260478564/1529747875364474921
