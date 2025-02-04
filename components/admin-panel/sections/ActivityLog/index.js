import React from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@apollo/client';
import { isEmpty, omit, omitBy } from 'lodash';
import { useRouter } from 'next/router';
import { FormattedMessage, useIntl } from 'react-intl';
import styled from 'styled-components';

import { parseDateInterval } from '../../../../lib/date-utils';
import { API_V2_CONTEXT, gqlV2 } from '../../../../lib/graphql/helpers';
import { ActivityDescriptionI18n } from '../../../../lib/i18n/activities';
import formatMemberRole from '../../../../lib/i18n/member-role';
import { getCollectivePageRoute } from '../../../../lib/url-helpers';

import Avatar from '../../../Avatar';
import Container from '../../../Container';
import DateTime from '../../../DateTime';
import { Box, Flex } from '../../../Grid';
import Link from '../../../Link';
import LinkCollective from '../../../LinkCollective';
import LinkExpense from '../../../LinkExpense';
import LoadingPlaceholder from '../../../LoadingPlaceholder';
import MessageBox from '../../../MessageBox';
import MessageBoxGraphqlError from '../../../MessageBoxGraphqlError';
import Pagination from '../../../Pagination';
import StyledCard from '../../../StyledCard';
import StyledLink from '../../../StyledLink';
import { P, Span } from '../../../Text';

import ActivityFilters from './ActivityFilters';
import { getActivityTypeFilterValuesFromKey, isSupportedActivityTypeFilter } from './ActivityTypeFilter';

const activityLogQuery = gqlV2/* GraphQL */ `
  query AccountActivityLog(
    $accountSlug: String!
    $limit: Int
    $offset: Int
    $dateFrom: DateTime
    $dateTo: DateTime
    $type: [ActivityAndClassesType!]
    $account: [AccountReferenceInput!]!
    $includeHostedAccounts: Boolean
    $includeChildrenAccounts: Boolean
    $excludeParentAccount: Boolean
  ) {
    account(slug: $accountSlug) {
      id
      name
      slug
      legacyId
      isHost
      type
      ... on Collective {
        childrenAccounts {
          totalCount
        }
      }
    }
    activities(
      account: $account
      limit: $limit
      offset: $offset
      dateFrom: $dateFrom
      dateTo: $dateTo
      type: $type
      includeHostedAccounts: $includeHostedAccounts
      includeChildrenAccounts: $includeChildrenAccounts
      excludeParentAccount: $excludeParentAccount
    ) {
      offset
      limit
      totalCount
      nodes {
        id
        createdAt
        type
        data
        isSystem
        fromAccount {
          id
          name
          slug
        }
        account {
          id
          name
          slug
          ... on AccountWithParent {
            parent {
              id
              slug
            }
          }
        }
        expense {
          id
          legacyId
          description
          account {
            id
            name
            type
            slug
            ... on AccountWithParent {
              parent {
                id
                slug
              }
            }
          }
        }
        order {
          id
          legacyId
          description
          toAccount {
            id
            name
            slug
            ... on AccountWithParent {
              parent {
                id
                slug
              }
            }
          }
        }
        individual {
          id
          slug
          name
          type
          imageUrl(height: 48)
        }
      }
    }
  }
`;

const ActivityLogContainer = styled(StyledCard)`
  & > *:not(:last-child) {
    border-bottom: 1px solid #dcdde0;
  }

  a {
    color: black;
    text-decoration: underline dotted;
    &:hover {
      color: #4e5052;
    }
  }
`;

const MetadataContainer = styled.div`
  display: flex;
  align-items: center;
  grid-gap: 8px;
  color: #4d4f51;
  margin-top: 10px;
  a {
    color: #4d4f51;
    text-decoration: none;
    &:hover {
      color: #4e5052;
    }
  }
`;

const ACTIVITY_LIMIT = 10;

const getQueryVariables = (accountSlug, router) => {
  const routerQuery = omit(router.query, ['slug', 'section']);
  const offset = parseInt(routerQuery.offset) || 0;
  const { period, type, account } = routerQuery;
  const { from: dateFrom, to: dateTo } = parseDateInterval(period);

  // Account filters
  let filteredAccounts = { slug: accountSlug };
  let includeChildrenAccounts, includeHostedAccounts, excludeParentAccount;
  if (account === '__CHILDREN_ACCOUNTS__') {
    includeChildrenAccounts = true;
    excludeParentAccount = true;
  } else if (account === '__HOSTED_ACCOUNTS__') {
    includeHostedAccounts = true;
  } else if (account) {
    filteredAccounts = account.split(',').map(slug => ({ slug }));
    includeChildrenAccounts = true; // By default, we include children of selected accounts
  }

  return {
    accountSlug,
    dateFrom,
    dateTo,
    limit: ACTIVITY_LIMIT,
    offset,
    type: getActivityTypeFilterValuesFromKey(type),
    account: filteredAccounts,
    includeChildrenAccounts,
    excludeParentAccount,
    includeHostedAccounts,
  };
};

const getChangesThatRequireUpdate = (account, queryParams) => {
  const changes = {};
  if (!account) {
    return changes;
  }

  if (!isSupportedActivityTypeFilter(account, queryParams.type)) {
    changes.type = null;
  }
  return changes;
};

const ActivityLog = ({ accountSlug }) => {
  const intl = useIntl();
  const router = useRouter();
  const routerQuery = omit(router.query, ['slug', 'section']);
  const offset = parseInt(routerQuery.offset) || 0;
  const { data, loading, error } = useQuery(activityLogQuery, {
    variables: getQueryVariables(accountSlug, router),
    context: API_V2_CONTEXT,
    fetchPolicy: 'network-only',
  });

  const handleUpdateFilters = queryParams => {
    const pathname = router.asPath.split('?')[0];
    return router.push({
      pathname,
      query: omitBy({ ...routerQuery, ...queryParams }, value => !value),
    });
  };

  // Reset type if not supported by the account
  React.useEffect(() => {
    const changesThatRequireUpdate = getChangesThatRequireUpdate(data?.account, routerQuery);
    if (!isEmpty(changesThatRequireUpdate)) {
      handleUpdateFilters({ ...routerQuery, ...changesThatRequireUpdate });
    }
  }, [data?.account, routerQuery]);

  return (
    <Box mt={3}>
      <ActivityFilters
        filters={routerQuery}
        onChange={queryParams => handleUpdateFilters({ ...queryParams, offset: null })}
        account={data?.account}
      />
      {error ? (
        <MessageBoxGraphqlError error={error} />
      ) : loading ? (
        <LoadingPlaceholder width="100%" height={163} />
      ) : !data?.activities?.nodes ? (
        <MessageBox type="error" withIcon>
          <FormattedMessage
            id="mustBeAdmin"
            defaultMessage="You must be an admin of this collective to see this page"
          />
        </MessageBox>
      ) : (
        <React.Fragment>
          {!data.activities.totalCount ? (
            <MessageBox type="info" withIcon>
              <FormattedMessage defaultMessage="No activity yet" />
            </MessageBox>
          ) : (
            <ActivityLogContainer>
              {data.activities.nodes.map(activity => (
                <Box key={activity.id} px="16px" py="14px">
                  <P color="black.900" fontWeight="500" fontSize="14px">
                    {ActivityDescriptionI18n[activity.type]
                      ? intl.formatMessage(ActivityDescriptionI18n[activity.type], {
                          FromAccount: () => <LinkCollective collective={activity.fromAccount} openInNewTab />,
                          Account: () => <LinkCollective collective={activity.account} openInNewTab />,
                          Expense: msg =>
                            !activity.expense ? (
                              msg
                            ) : (
                              <LinkExpense
                                collective={activity.expense.account}
                                expense={activity.expense}
                                title={activity.expense.description}
                                openInNewTab
                              >
                                {msg} #{activity.expense.legacyId}
                              </LinkExpense>
                            ),
                          Order: msg =>
                            !activity.order ? (
                              msg
                            ) : (
                              <Link
                                href={`${getCollectivePageRoute(activity.order.toAccount)}/orders?searchTerm=%23${
                                  activity.order.legacyId
                                }`}
                                title={activity.order.description}
                                openInNewTab
                              >
                                {msg} #{activity.order.legacyId}
                              </Link>
                            ),
                          Host: () => <LinkCollective collective={activity.host} openInNewTab />,
                          MemberRole: () =>
                            activity.data?.member?.role ? formatMemberRole(intl, activity.data.member.role) : 'member',
                        })
                      : activity.type}
                  </P>
                  <MetadataContainer>
                    {activity.isSystem ? (
                      <Span>
                        <FormattedMessage defaultMessage="System Activity" />
                      </Span>
                    ) : (
                      <FormattedMessage
                        id="ByUser"
                        defaultMessage="By {userName}"
                        values={{
                          userName: !activity.individual ? (
                            <Span>
                              <FormattedMessage id="user.unknown" defaultMessage="Unknown" />
                            </Span>
                          ) : (
                            <StyledLink as={LinkCollective} color="black.700" collective={activity.individual}>
                              <Flex alignItems="center" gridGap="8px">
                                <Avatar radius={24} collective={activity.individual} />
                                {activity.individual.name}
                              </Flex>
                            </StyledLink>
                          ),
                        }}
                      />
                    )}
                    •
                    <DateTime value={activity.createdAt} dateStyle="medium" />
                  </MetadataContainer>
                </Box>
              ))}
            </ActivityLogContainer>
          )}
        </React.Fragment>
      )}
      {data?.activities?.totalCount > ACTIVITY_LIMIT && (
        <Container display="flex" justifyContent="center" fontSize="14px" my={3}>
          <Pagination
            offset={offset}
            total={data.activities.totalCount}
            limit={ACTIVITY_LIMIT}
            ignoredQueryParams={['slug', 'section']}
          />
        </Container>
      )}
    </Box>
  );
};

ActivityLog.propTypes = {
  accountSlug: PropTypes.string.isRequired,
};

export default ActivityLog;
