// GraphQL fragments for CLINK payment integration
export const CLINK_OFFER_FRAGMENT = `
  fragment ClinkOfferFields on ClinkOffer {
    id
    createdAt
    offerId
    noffer
    amountSats
    status
    bolt11Invoice
    expiresAt
  }
`;

export const CLINK_PAYMENT_STATUS_FRAGMENT = `
  fragment ClinkPaymentStatusFields on ClinkPaymentStatus {
    offerId
    status
    bolt11Invoice
    preimage
    noffer
    amountSats
  }
`;

// Query to get CLINK offer for an order
export const GET_CLINK_OFFER = `
  ${CLINK_OFFER_FRAGMENT}
  query GetClinkOffer($orderCode: String!) {
    clinkOffer(orderCode: $orderCode) {
      ...ClinkOfferFields
    }
  }
`;

// Query to check payment status
export const GET_CLINK_PAYMENT_STATUS = `
  ${CLINK_PAYMENT_STATUS_FRAGMENT}
  query GetClinkPaymentStatus($orderCode: String!) {
    clinkPaymentStatus(orderCode: $orderCode) {
      ...ClinkPaymentStatusFields
    }
  }
`;

// Mutation to add CLINK payment to order
export const ADD_CLINK_PAYMENT = `
  mutation AddClinkPayment($orderCode: String!) {
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
`;
