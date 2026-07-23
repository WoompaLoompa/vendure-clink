import gql from 'graphql-tag';

export const shopApiExtensions = gql`
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

  type ClinkPaymentStatus {
    offerId: String!
    status: String!
    bolt11Invoice: String
    preimage: String
    noffer: String
    amountSats: Int!
  }

  extend type Query {
    clinkOffer(orderCode: String!): ClinkOffer
    clinkPaymentStatus(orderCode: String!): ClinkPaymentStatus
  }
`;
