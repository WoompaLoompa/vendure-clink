# Changelog

## 0.2.0 (2026-07-23)

### Security

- **CRITICAL**: Added HMAC-SHA256 signature verification for all webhook endpoints (`x-clink-signature` header)
- **CRITICAL**: Added preimage verification — `sha256(preimage) === payment_hash` is now enforced before settling
- Added BOLT11 invoice decoding to extract payment hash and amount for verification
- Added amount validation — bolt11 invoice amount must match offer amount
- Added Nostr event signature verification (`verifyEvent`) for relay payments
- Added `webhookSecret` config option — **required when `httpFallback` is enabled**

### Changed

- Webhook endpoints now reject all requests without valid HMAC signature
- Webhook endpoints now reject requests without preimage verification

## 0.1.0 (2026-07-23)

### Features

- Initial release of the Bitcoin Lightning CLINK plugin for Vendure
- `ClinkPaymentHandler` — asynchronous payment handler with BTC price oracle
- `ClinkPaymentProcess` — custom payment state machine (`Created → Pending → Settled/Error/Cancelled`)
- `OracleService` — BTC/USD price oracle with CoinGecko, Kraken, and custom providers
- Per-channel Nostr keypair generation and relay configuration
- Shop API: create payment offers, poll payment status
- Admin API: configure CLINK settings, manage offers, test oracle providers
- HTTP webhook fallback for wallets without Nostr support
- Storefront React component (`ClinkPayment`)
- Comprehensive unit tests (43 tests)
