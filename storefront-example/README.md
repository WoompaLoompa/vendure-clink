# @vendure-clink/storefront

React component for accepting Bitcoin Lightning payments via [CLINK](https://clinkme.dev) in [Vendure](https://www.vendure.io/) storefronts.

## Install

```bash
npm install @vendure-clink/storefront
```

Peer dependencies: `react ^18.0.0`

## Quick Start

```tsx
import { ClinkPayment } from '@vendure-clink/storefront';

function CheckoutPage({ orderCode }: { orderCode: string }) {
  return (
    <ClinkPayment
      orderCode={orderCode}
      apiEndpoint="https://your-store.com/shop-api"
      onPaymentConfirmed={(preimage) => {
        window.location.href = `/order/${orderCode}/confirmed`;
      }}
      onPaymentExpired={() => {
        alert('Payment expired. Please try again.');
      }}
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `orderCode` | `string` | **required** | Vendure order code |
| `apiEndpoint` | `string` | `http://localhost:3000/shop-api` | Vendure Shop API URL |
| `pollIntervalMs` | `number` | `3000` | Payment status poll interval (ms) |
| `onPaymentConfirmed` | `(preimage: string) => void` | — | Called when payment confirmed |
| `onPaymentExpired` | `() => void` | — | Called when offer expires |
| `onPaymentError` | `(error: string) => void` | — | Called on fetch/API errors |
| `className` | `string` | `''` | Additional CSS class |

## Component States

The component handles four states automatically:

1. **Loading** — Fetching offer from Vendure API
2. **Pending** — Displaying `noffer1...` code, countdown timer, polling for status
3. **Paid** — Success confirmation with checkmark
4. **Expired** — Offer expired, retry button

## CSS Classes

All classes are prefixed with `clink-` to avoid conflicts:

```css
.clink-payment {
  max-width: 400px;
  margin: 0 auto;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.clink-payment h3 {
  margin: 0 0 16px;
  font-size: 1.25rem;
}

.clink-amount {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
}

.clink-timer {
  color: #e65100;
  font-weight: 600;
  margin: 8px 0 0;
}

.clink-noffer-section {
  margin: 20px 0;
}

.clink-label {
  font-size: 0.875rem;
  color: #666;
  margin: 0 0 8px;
}

.clink-noffer-string {
  display: flex;
  gap: 8px;
  align-items: center;
}

.clink-noffer-string code {
  flex: 1;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 6px;
  font-size: 0.8rem;
  word-break: break-all;
  font-family: 'SF Mono', Monaco, monospace;
}

.clink-copy-btn {
  padding: 12px 16px;
  background: #1a1a1a;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  white-space: nowrap;
}

.clink-copy-btn:hover {
  background: #333;
}

.clink-instructions {
  margin: 16px 0;
  font-size: 0.875rem;
  color: #555;
  line-height: 1.5;
}

.clink-supported-wallets {
  color: #888;
  font-size: 0.8rem;
}

.clink-status-check {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.clink-pulse {
  width: 12px;
  height: 12px;
  background: #4caf50;
  border-radius: 50%;
  animation: clink-pulse 2s infinite;
}

@keyframes clink-pulse {
  0%   { opacity: 1; transform: scale(1); }
  50%  { opacity: 0.5; transform: scale(1.2); }
  100% { opacity: 1; transform: scale(1); }
}

.clink-payment.success {
  background: #e8f5e9;
  text-align: center;
}

.clink-checkmark {
  font-size: 3rem;
  color: #4caf50;
}

.clink-payment.expired {
  background: #fff3e0;
  text-align: center;
}

.clink-payment.error {
  background: #ffebee;
  text-align: center;
}

.clink-error-message {
  color: #c62828;
}

.clink-retry-btn {
  margin-top: 12px;
  padding: 10px 20px;
  background: #1a1a1a;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}
```

## Vendure Setup

Ensure the CLINK plugin is configured in your Vendure server:

```typescript
// vendure-config.ts
import { ClinkPlugin } from 'vendure-plugin-bitcoin-lightning-via-clink';

export const config: VendureConfig = {
  plugins: [
    ClinkPlugin.init({
      relays: ['wss://relay.shocknetwork.com'],
    }),
  ],
};
```

## GraphQL Queries

The component uses these Vendure Shop API queries:

```graphql
query GetClinkOffer($orderCode: String!) {
  clinkOffer(orderCode: $orderCode) {
    offerId
    noffer
    amountSats
    status
    bolt11Invoice
    expiresAt
  }
}

query GetClinkPaymentStatus($orderCode: String!) {
  clinkPaymentStatus(orderCode: $orderCode) {
    offerId
    status
    bolt11Invoice
    preimage
    noffer
    amountSats
  }
}
```

## Flow

1. Customer completes checkout, receives `orderCode`
2. `ClinkPayment` fetches CLINK offer via GraphQL
3. Displays `noffer1...` string with copy button and countdown
4. Customer scans/pastes offer in CLINK-compatible wallet
5. Component polls `clinkPaymentStatus` every 3 seconds
6. On confirmed: triggers `onPaymentConfirmed(preimage)`
7. On expired: triggers `onPaymentExpired()`

## Advanced Usage

### Custom Styling

```tsx
<ClinkPayment
  orderCode={orderCode}
  className="my-custom-theme"
/>
```

### With Next.js

```tsx
'use client';
import { ClinkPayment } from '@vendure-clink/storefront';

export default function PaymentPage({ params }: { params: { orderCode: string } }) {
  return (
    <ClinkPayment
      orderCode={params.orderCode}
      apiEndpoint={process.env.NEXT_PUBLIC_VENDURE_API_URL}
      onPaymentConfirmed={(preimage) => {
        // Server-side validation possible with preimage
        window.location.href = `/orders/success?preimage=${preimage}`;
      }}
    />
  );
}
```
