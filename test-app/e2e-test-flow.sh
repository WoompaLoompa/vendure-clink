#!/bin/bash
# E2E test flow for vendure-clink plugin
# Usage: ./e2e-test-flow.sh [variantId]
set -e

VARIANT_ID="${1:-1}"
SHOP="http://localhost:12345/shop-api"
SHOP_COOKIES="/tmp/vendure-shop-cookies.txt"

shop() {
  curl -s -c "$SHOP_COOKIES" -b "$SHOP_COOKIES" -X POST "$SHOP" -H "Content-Type: application/json" -d "$1"
}

echo "===== E2E TEST FLOW ====="
echo "Variant ID: $VARIANT_ID"
echo ""

# 1. Add item to order
echo ">>> 1. Adding item to order..."
shop '{"query":"mutation { addItemToOrder(productVariantId: "'$VARIANT_ID'", quantity: 1) { ... on Order { id code state total } ... on InsufficientStockError { message } } }"}' | python3 -m json.tool
echo ""

# 2. Set shipping address
echo ">>> 2. Setting shipping address..."
shop '{"query":"mutation { setOrderShippingAddress(input: { fullName: \"Test User\", streetLine1: \"123 Main St\", city: \"New York\", postalCode: \"10001\", countryCode: \"US\" }) { ... on Order { id code state } } }"}' | python3 -m json.tool
echo ""

# 3. Set billing address
echo ">>> 3. Setting billing address..."
shop '{"query":"mutation { setOrderBillingAddress(input: { fullName: \"Test User\", streetLine1: \"123 Main St\", city: \"New York\", postalCode: \"10001\", countryCode: \"US\" }) { ... on Order { id code state } } }"}' | python3 -m json.tool
echo ""

# 4. Set customer
echo ">>> 4. Setting customer..."
shop '{"query":"mutation { setCustomerForOrder(input: { emailAddress: \"test@example.com\", firstName: \"Test\", lastName: \"User\" }) { ... on Order { id code state } } }"}' | python3 -m json.tool
echo ""

# 5. Set shipping method
echo ">>> 5. Setting shipping method..."
shop '{"query":"mutation { setOrderShippingMethod(shippingMethodId: \"1\") { ... on Order { id code state } ... on IneligibleShippingMethodError { message } } }"}' | python3 -m json.tool
echo ""

# 6. Transition to ArrangingPayment
echo ">>> 6. Transitioning to ArrangingPayment..."
shop '{"query":"mutation { transitionOrderToState(state: \"ArrangingPayment\") { ... on Order { id code state } ... on OrderStateTransitionError { message } } }"}' | python3 -m json.tool
echo ""

# 7. Add CLINK payment
echo ">>> 7. Adding CLINK payment..."
PAYMENT_RESULT=$(shop '{"query":"mutation { addPaymentToOrder(input: { method: \"clink-lightning\", metadata: [{ key: \"relayUrls\", value: \"wss://relay.shocknetwork.com\" }] }) { ... on Order { id code state payments { id method state amount transactionId metadata { key value } } } ... on PaymentFailedError { message } } }"}')
echo "$PAYMENT_RESULT" | python3 -m json.tool
echo ""

# 8. Extract noffer
echo ">>> 8. Extracting noffer..."
NOFFER=$(echo "$PAYMENT_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
payments = data['data']['addPaymentToOrder']['payments']
if payments:
    meta = payments[0].get('metadata', {})
    if isinstance(meta, dict):
        public = meta.get('public', {})
        if isinstance(public, dict):
            print(public.get('noffer', 'N/A'))
        else:
            for item in meta if isinstance(meta, list) else []:
                if item.get('key') == 'noffer':
                    print(item.get('value', 'N/A'))
                    break
    else:
        print('N/A')
else:
    print('N/A')
")
echo "Offer: $NOFFER"

echo ""
echo "===== TEST COMPLETE ====="
echo ""
echo "Next steps:"
echo "  1. Open a CLINK-compatible wallet (ShockWallet, ZEUS)"
echo "  2. Scan or paste the noffer above"
echo "  3. Pay the Lightning invoice"
echo "  4. The payment will be confirmed automatically"
