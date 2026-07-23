import gql from 'graphql-tag';

export const adminApiExtensions = gql`
  type ClinkOffer implements Node {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    offerId: String!
    noffer: String!
    amountSats: Int!
    pricingType: Int!
    status: String!
    bolt11Invoice: String
    expiresAt: DateTime
    paidAt: DateTime
  }

  type ClinkChannelConfig implements Node {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    nostrPubkey: String!
    relayUrls: [String!]!
    autoSettle: Boolean!
    offerExpiryMinutes: Int!
    httpFallback: Boolean!
    paymentHandlerCode: String!
  }

  type ClinkOfferList implements PaginatedList {
    items: [ClinkOffer!]!
    totalItems: Int!
  }

  type OraclePrice {
    btcUsd: Float!
    provider: String!
    timestamp: DateTime!
  }

  type OracleTestResult {
    success: Boolean!
    provider: String!
    price: OraclePrice
    error: String
  }

  input ClinkConfigInput {
    relayUrls: [String!]
    autoSettle: Boolean
    offerExpiryMinutes: Int
    httpFallback: Boolean
  }

  extend type Query {
    clinkConfig(channelId: ID!): ClinkChannelConfig
    clinkOffers(status: String, limit: Int, offset: Int): ClinkOfferList!
    oraclePrice: OraclePrice!
  }

  extend type Mutation {
    updateClinkConfig(channelId: ID!, input: ClinkConfigInput!): ClinkChannelConfig!
    testOraclePrice(provider: String!): OracleTestResult!
  }
`;
