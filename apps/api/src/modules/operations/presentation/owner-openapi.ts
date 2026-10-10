/** Explicit Swagger schemas for owner API contracts. Runtime input validation remains Zod; these
 * documentation schemas are tested against the corresponding Zod restrictions.
 * Never publish private contact data, credentials or full identity records in owner responses.
 */
const uuid = { type: 'string', format: 'uuid' } as const;
const count = { type: 'integer', minimum: 0 } as const;
const period = { type: 'object', required: ['from','to'], properties: {
  from: { type: 'string', format: 'date-time' }, to: { type: 'string', format: 'date-time' },
} } as const;
const observedCount = { type: 'object', required: ['status','count'], properties: {
  status: { type: 'string' }, count,
} } as const;
const group = { type: 'array', items: observedCount } as const;
const staffReview = { type: 'object', required: ['id','status'], properties: {
  id: uuid, status: { type: 'string' },
} } as const;
export const OwnerApiContracts = {
  overviewResponse: { type: 'object', properties: {
    operations: { type: 'object', description: 'Observed operational aggregates; see /operations/reports for definitions' },
    customersByStatus: group, openSupportCases: count, delegatedRoleAssignments: count,
  } },
  riskResponse: { type: 'object', properties: {
    period, providerOutcomes: { type: 'array', items: { type: 'object', properties: {
      type: { type: 'string' }, status: { type: 'string' }, count,
    } } }, providerCircuits: { type: 'array', items: { type: 'object' } },
    securityEvents: { type: 'array', items: { type: 'object' } },
    tickets: { type: 'object' }, pendingOwnerReviews: { type: 'object' },
    ownerAuditActionsInPeriod: count, caveat: { type: 'string' },
  } },
  activityResponse: { type: 'object', properties: {
    userId: uuid, status: { type: 'string' }, period,
    transactions: { type: 'array', items: { type: 'object' } },
    supportCases: group, eventOrders: group, securityEventCount: count,
    recentTransactions: { type: 'array', maxItems: 20, items: { type: 'object', properties: {
      id: uuid, type: { type: 'string' }, status: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' },
    } } },
    recentSupport: { type: 'array', maxItems: 20, items: { type: 'object', properties: {
      reference: { type: 'string' }, status: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' },
    } } }, caveat: { type: 'string' },
  } },
  customersResponse: { type: 'object', properties: {
    bounded: { type: 'boolean' }, customers: { type: 'array', items: { type: 'object', properties: {
      id: uuid, emailMasked: { type: 'string' }, status: { type: 'string' },
      contactVerified: { type: 'boolean' }, financialEligibility: { type: 'string' },
      kycTier: count, createdAt: { type: 'string', format: 'date-time' },
    } } },
  } },
  staffResponse: { type: 'object', properties: {
    bounded: { type: 'boolean' }, staff: { type: 'array', items: { type: 'object' } },
  } },
  reviewsResponse: { type: 'object', properties: {
    bounded: { type: 'boolean' }, reviews: { type: 'array', items: { type: 'object' } },
  } },
  suspensionsResponse: { type: 'object', properties: {
    bounded: { type: 'boolean' }, reviews: { type: 'array', items: { type: 'object' } },
  } },
  staffProposal: { type: 'object', additionalProperties: false,
    required: ['targetUserId','roleCode','action','reason'], properties: {
      targetUserId: uuid, roleCode: { type: 'string', enum: ['SUPPORT_AGENT','AUDITOR','COMPLIANCE'] },
      action: { type: 'string', enum: ['GRANT','REVOKE'] },
      reason: { type: 'string', minLength: 20, maxLength: 500 },
    } },
  suspensionProposal: { type: 'object', additionalProperties: false,
    required: ['targetUserId','reason'], properties: {
      targetUserId: uuid, reason: { type: 'string', minLength: 20, maxLength: 500 },
    } },
  staffRejection: { type: 'object', additionalProperties: false,
    required: ['reason'], properties: { reason: { type: 'string', minLength: 20, maxLength: 500 } },
  },
  mutationResponse: { type: 'object', properties: { review: staffReview } },
} as const;
