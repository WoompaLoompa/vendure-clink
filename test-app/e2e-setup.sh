#!/bin/bash
# E2E setup script for vendure-clink plugin
set -e

ADMIN="http://localhost:12345/admin-api"
SHOP="http://localhost:12345/shop-api"
COOKIE_JAR="/tmp/vendure-admin-cookies.txt"
SHOP_COOKIES="/tmp/vendure-shop-cookies.txt"

admin() {
  curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" -X POST "$ADMIN" -H "Content-Type: application/json" -d "$1"
}

shop() {
  curl -s -c "$SHOP_COOKIES" -b "$SHOP_COOKIES" -X POST "$SHOP" -H "Content-Type: application/json" -d "$1"
}

# ===== 1. Admin login =====
echo ">>> Admin login..."
admin '{"query":"mutation { authenticate(input: { native: { username: \"superadmin\", password: \"superadmin\" } }) { ... on CurrentUser { id } } }"}' > /dev/null
echo "OK"

# ===== 2. Create country =====
echo ">>> Create US country..."
admin '{"query":"mutation { createCountry(input: { code: \"US\", translations: [{ languageCode: en, name: \"United States\" }], enabled: true }) { id code } }"}' > /dev/null
echo "OK"

# ===== 3. Create zone =====
echo ">>> Create zone..."
admin '{"query":"mutation { createZone(input: { name: \"Global\" }) { id } }"}' > /dev/null
echo "OK"

# ===== 4. Add zone members =====
echo ">>> Add zone members..."
admin '{"query":"mutation { addMembersToZone(zoneId: \"1\", memberIds: [\"1\"]) { id } }"}' > /dev/null
echo "OK"

# ===== 5. Set channel tax zone =====
echo ">>> Set channel tax zone..."
admin '{"query":"mutation { updateChannel(input: { id: \"1\", defaultTaxZoneId: \"1\" }) { ... on Channel { id defaultTaxZone { name } } } }"}' > /dev/null
echo "OK"

# ===== 6. Create product =====
echo ">>> Create product..."
PRODUCT_RESULT=$(admin '{"query":"mutation { createProduct(input: { translations: [{ languageCode: en, name: \"Lightning Coffee\", slug: \"lightning-coffee\", description: \"Pay with sats\" }] }) { id slug } }"}')
PRODUCT_ID=$(echo "$PRODUCT_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['createProduct']['id'])")
echo "Product ID: $PRODUCT_ID"

# ===== 7. Create variant ($5.00 = 500 cents) =====
echo ">>> Create variant..."
VARIANT_RESULT=$(admin '{"query":"mutation { createProductVariants(input: [{ productId: \"'$PRODUCT_ID'\", sku: \"COFFEE-001\", price: 500, translations: [{ languageCode: en, name: \"Regular\" }], stockOnHand: 100 }]) { id name price } }"}')
VARIANT_ID=$(echo "$VARIANT_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['createProductVariants'][0]['id'])")
echo "Variant ID: $VARIANT_ID"

# ===== 8. Create shipping method =====
echo ">>> Create shipping method..."
admin '{"query":"mutation { createShippingMethod(input: { code: \"standard\", fulfillmentHandler: \"manual-fulfillment\", translations: [{ languageCode: en, name: \"Standard Shipping\" }], calculator: { code: \"default-shipping-calculator\", arguments: [{ name: \"rate\", value: \"0\" }, { name: \"includesTax\", value: \"false\" }, { name: \"taxRate\", value: \"0\" }] }, checker: { code: \"default-shipping-eligibility-checker\", arguments: [{ name: \"orderMinimum\", value: \"0\" }] } }) { id name } }"}' > /dev/null
echo "OK"

# ===== 9. Assign shipping method to channel =====
echo ">>> Assign shipping to channel..."
admin '{"query":"mutation { assignShippingMethodsToChannel(input: { shippingMethodIds: [\"1\"], channelId: \"1\" }) { id name } }"}' > /dev/null
echo "OK"

# ===== 10. Create CLINK payment method =====
echo ">>> Create CLINK payment method..."
admin '{"query":"mutation { createPaymentMethod(input: { code: \"clink-lightning\", enabled: true, handler: { code: \"clink-lightning\", arguments: [{ name: \"relayUrls\", value: \"wss://relay.shocknetwork.com\" }, { name: \"offerExpiryMinutes\", value: \"60\" }] }, translations: [{ languageCode: en, name: \"Bitcoin Lightning (CLINK)\", description: \"Pay with Lightning via CLINK\" }] }) { id code } }"}' > /dev/null
echo "OK"

# ===== 11. Assign payment method to channel =====
echo ">>> Assign payment to channel..."
admin '{"query":"mutation { assignPaymentMethodsToChannel(input: { paymentMethodIds: [\"1\"], channelId: \"1\" }) { id name } }"}' > /dev/null
echo "OK"

# ===== 12. Verify oracle =====
echo ">>> Checking oracle price..."
ORACLE_RESULT=$(admin '{"query":"{ oraclePrice { btcUsd provider timestamp } }"}')
echo "Oracle: $ORACLE_RESULT" | python3 -m json.tool 2>/dev/null || echo "Oracle: $ORACLE_RESULT"

echo ""
echo "===== SETUP COMPLETE ====="
echo "Product ID: $PRODUCT_ID"
echo "Variant ID: $VARIANT_ID"
echo ""
echo "Now test the shop flow:"
echo "  ./e2e-test-flow.sh $VARIANT_ID"
