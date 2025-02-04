import { gqlV2 } from '../../../lib/graphql/helpers';

const contributionFlowHostFieldsFragment = gqlV2/* GraphQL */ `
  fragment ContributionFlowHostFields on Host {
    id
    legacyId
    slug
    name
    settings
    contributionPolicy
    location {
      id
      country
    }
    paypalClientId
    supportedPaymentMethods
    payoutMethods {
      id
      name
      data
      type
    }
  }
`;

export const contributionFlowAccountFieldsFragment = gqlV2/* GraphQL */ `
  fragment ContributionFlowAccountFields on Account {
    id
    legacyId
    slug
    type
    name
    currency
    settings
    twitterHandle
    description
    imageUrl(height: 192)
    isHost
    isActive
    settings
    location {
      id
      country
    }
    features {
      id
      RECEIVE_FINANCIAL_CONTRIBUTIONS
    }
    ... on Organization {
      platformFeePercent
      platformContributionAvailable
      host {
        id
        ...ContributionFlowHostFields
      }
    }
    ... on AccountWithContributions {
      contributionPolicy
      platformFeePercent
      platformContributionAvailable
      contributors(limit: 6) {
        totalCount
        nodes {
          id
          name
          image
          collectiveSlug
        }
      }
    }
    ... on AccountWithHost {
      hostFeePercent
      host {
        id
        ...ContributionFlowHostFields
      }
    }
    ... on AccountWithParent {
      parent {
        id
        slug
        settings
        location {
          id
          country
        }
        ... on AccountWithContributions {
          contributionPolicy
        }
      }
    }
    ... on Event {
      endsAt
    }
  }
  ${contributionFlowHostFieldsFragment}
`;

const orderSuccessHostFragment = gqlV2/* GraphQL */ `
  fragment OrderSuccessHostFragment on Host {
    id
    slug
    settings
    bankAccount {
      id
      name
      data
      type
    }
  }
`;

export const orderSuccessFragment = gqlV2/* GraphQL */ `
  fragment OrderSuccessFragment on Order {
    id
    legacyId
    status
    frequency
    data
    amount {
      value
      valueInCents
      currency
    }
    paymentMethod {
      id
      service
      type
      data
    }
    platformTipAmount {
      value
      valueInCents
      currency
    }
    tier {
      id
      name
    }
    membership {
      id
      publicMessage
    }
    fromAccount {
      id
      name
      type
      imageUrl(height: 48)
      ... on Individual {
        isGuest
      }
    }
    toAccount {
      id
      name
      slug
      tags
      type
      isHost
      settings
      ... on AccountWithContributions {
        # limit: 1 as current best practice to avoid the API fetching entries it doesn't need
        contributors(limit: 1) {
          totalCount
        }
      }
      ... on AccountWithParent {
        parent {
          id
          slug
        }
      }
      ... on AccountWithHost {
        host {
          id
          ...OrderSuccessHostFragment
        }
      }
      ... on Organization {
        host {
          id
          ...OrderSuccessHostFragment
          ... on AccountWithContributions {
            # limit: 1 as current best practice to avoid the API fetching entries it doesn't need
            contributors(limit: 1) {
              totalCount
            }
          }
        }
      }
    }
  }
  ${orderSuccessHostFragment}
`;

export const orderResponseFragment = gqlV2/* GraphQL */ `
  fragment OrderResponseFragment on OrderWithPayment {
    guestToken
    order {
      id
      ...OrderSuccessFragment
    }
    stripeError {
      message
      account
      response
    }
  }
  ${orderSuccessFragment}
`;
