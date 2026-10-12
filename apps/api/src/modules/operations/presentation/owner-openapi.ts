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
type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
const contracts = {
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
  invitationsResponse: { type: 'object', properties: { bounded: { type: 'boolean' },
    invitations: { type: 'array', items: { type: 'object', properties: { id: uuid,
      emailMasked: { type: 'string' }, roleCode: { type: 'string' }, status: { type: 'string' }, expiresAt: { type: 'string', format: 'date-time' },
    } } } } },
  myInvitationsResponse: { type: 'object', properties: {
    invitations: { type: 'array', items: { type: 'object', properties: { id: uuid, roleCode: { type: 'string' }, expiresAt: { type: 'string', format: 'date-time' } } } },
  } },
  invitationProposal: { type: 'object', additionalProperties: false, required: ['email','roleCode','reason'], properties: {
    email: { type: 'string', format: 'email', maxLength: 320 },
    roleCode: { type: 'string', enum: ['SUPPORT_AGENT','AUDITOR','COMPLIANCE'] },
    reason: { type: 'string', minLength: 20, maxLength: 500 },
  } },
  invitationDecision: { type: 'object', additionalProperties: false, properties: {
    reason: { type: 'string', minLength: 20, maxLength: 500 },
  } },
  acceptanceResponse: { type: 'object', properties: { status: { type: 'string', enum: ['ACCEPTED'] }, signInAgain: { type: 'boolean' } } },
  configReviewsResponse: { type: 'object', properties: { bounded: { type: 'boolean' }, reviews: { type: 'array', items: { type: 'object' } } } },
  configProposal: {
    oneOf: [
      { type: 'object', additionalProperties: false, required: ['kind','data','reason'], properties: {
        kind: { type: 'string', enum: ['BRAND'] },
        data: { type: 'object', additionalProperties: false,
          required: ['productName','legalName','domain','supportEmail','primaryColor','accentColor'],
          properties: {
            productName: { type: 'string', minLength: 2, maxLength: 120 },
            legalName: { type: 'string', minLength: 2, maxLength: 180 },
            domain: { type: 'string', minLength: 3, maxLength: 255 },
            supportEmail: { type: 'string', format: 'email' },
            logoUrl: { type: 'string', format: 'uri', nullable: true },
            primaryColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            accentColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            privacyUrl: { type: 'string', format: 'uri', nullable: true },
            termsUrl: { type: 'string', format: 'uri', nullable: true },
          },
        },
        reason: { type: 'string', minLength: 20, maxLength: 500 },
      } },
      { type: 'object', additionalProperties: false, required: ['kind','data','reason'], properties: {
        kind: { type: 'string', enum: ['DEPLOYMENT'] },
        data: { type: 'object', additionalProperties: false,
          required: ['productSlug','edition','licensedTo','status','allowedModules','supportMode'],
          properties: {
            productSlug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', maxLength: 120 },
            edition: { type: 'string', enum: ['TWIPAY_OWNED','WHITE_LABEL','ENTERPRISE_SOURCE'] },
            licensedTo: { type: 'string', maxLength: 180 },
            status: { type: 'string', enum: ['ACTIVE','SUSPENDED','EXPIRED'] },
            allowedModules: { type: 'array', minItems: 1, maxItems: 50, items: { type: 'string' } },
            supportMode: { type: 'string', enum: ['SELF_MANAGED','OCTALVE_MANAGED','ENTERPRISE_SUPPORT'] },
            licenseReference: { type: 'string', nullable: true },
            validUntil: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        reason: { type: 'string', minLength: 20, maxLength: 500 },
      } },
      { type: 'object', additionalProperties: false, required: ['kind','data','reason'], properties: {
        kind: { type: 'string', enum: ['FLAG_DISABLE'] },
        data: { type: 'object', additionalProperties: false, required: ['key','enabled','public'], properties: {
          key: { type: 'string', pattern: '^[a-z][a-z0-9_.-]{2,119}$' },
          enabled: { type: 'boolean', enum: [false] }, public: { type: 'boolean' },
          description: { type: 'string', maxLength: 500 },
        } },
        reason: { type: 'string', minLength: 20, maxLength: 500 },
      } },
    ],
  },
  mutationResponse: { type: 'object', properties: { review: staffReview } },
} as const;
/** Swagger's SchemaObject requires mutable arrays; the values themselves are unchanged. */
export const OwnerApiContracts = contracts as Mutable<typeof contracts>;
