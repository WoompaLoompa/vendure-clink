# Changelog

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
