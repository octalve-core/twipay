-- Batch 3 services + events.
-- Provider fulfilment remains evidence; TwiPay ledger and domain state remain source of truth.

ALTER TYPE "ProviderOperationType" ADD VALUE IF NOT EXISTS 'BILL_PURCHASE';
ALTER TYPE "ProviderOperationType" ADD VALUE IF NOT EXISTS 'NOTIFICATION';
ALTER TYPE "ReconciliationCaseType" ADD VALUE IF NOT EXISTS 'SERVICE_FULFILLMENT_MISMATCH';
ALTER TYPE "ReconciliationCaseType" ADD VALUE IF NOT EXISTS 'EVENT_SETTLEMENT_MISMATCH';

CREATE TYPE "BillCategory" AS ENUM ('AIRTIME','DATA','ELECTRICITY','CABLE');
CREATE TYPE "BillProductStatus" AS ENUM ('ACTIVE','INACTIVE');
CREATE TYPE "BillPurchaseStatus" AS ENUM ('CREATED','VALIDATING','VALIDATED','FUNDS_RESERVED','PROVIDER_SUBMITTED','PROCESSING','UNKNOWN','SUCCEEDED','FAILED','REVERSED','CANCELLED');
CREATE TYPE "ProviderCircuitState" AS ENUM ('CLOSED','OPEN','HALF_OPEN');
CREATE TYPE "EventOrganizerStatus" AS ENUM ('ACTIVE','SUSPENDED','CLOSED');
CREATE TYPE "EventStatus" AS ENUM ('DRAFT','PUBLISHED','SALES_PAUSED','SOLD_OUT','CANCELLED','COMPLETED');
CREATE TYPE "TicketTypeStatus" AS ENUM ('ACTIVE','PAUSED','SOLD_OUT','CLOSED');
CREATE TYPE "EventOrderStatus" AS ENUM ('CREATED','FUNDS_RESERVED','PAID','FAILED','CANCELLED','REFUNDED');
CREATE TYPE "TicketStatus" AS ENUM ('ACTIVE','CHECKED_IN','CANCELLED','REFUNDED','VOID');
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL','SMS');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING','PROCESSING','ACCEPTED','DELIVERED','FAILED','UNKNOWN');

CREATE TABLE "bill_products" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(120) NOT NULL UNIQUE,
  "category" "BillCategory" NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "customerIdentifierType" VARCHAR(40) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "fixedAmountMinor" BIGINT,
  "minAmountMinor" BIGINT,
  "maxAmountMinor" BIGINT,
  "status" "BillProductStatus" NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bill_products_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "bill_products_amounts_check" CHECK (
    ("fixedAmountMinor" IS NULL OR "fixedAmountMinor" > 0) AND
    ("minAmountMinor" IS NULL OR "minAmountMinor" > 0) AND
    ("maxAmountMinor" IS NULL OR "maxAmountMinor" > 0) AND
    ("minAmountMinor" IS NULL OR "maxAmountMinor" IS NULL OR "minAmountMinor" <= "maxAmountMinor")
  )
);
CREATE INDEX "bill_products_category_status_idx" ON "bill_products"("category","status");

CREATE TABLE "bill_provider_offers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" UUID NOT NULL REFERENCES "bill_products"("id") ON DELETE RESTRICT,
  "providerCode" VARCHAR(40) NOT NULL,
  "providerProductCode" VARCHAR(160) NOT NULL,
  "providerBillerCode" VARCHAR(160) NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "estimatedCostMinor" BIGINT,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "requiresValidation" BOOLEAN NOT NULL DEFAULT FALSE,
  "metadata" JSONB,
  "lastSyncedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bill_provider_offers_cost_check" CHECK ("estimatedCostMinor" IS NULL OR "estimatedCostMinor" > 0),
  UNIQUE ("providerCode","providerProductCode","providerBillerCode")
);
CREATE INDEX "bill_provider_offers_product_active_priority_idx" ON "bill_provider_offers"("productId","active","priority");

CREATE TABLE "provider_capability_health" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "providerCode" VARCHAR(40) NOT NULL,
  "capability" VARCHAR(80) NOT NULL,
  "circuitState" "ProviderCircuitState" NOT NULL DEFAULT 'CLOSED',
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "successCount" BIGINT NOT NULL DEFAULT 0,
  "failureCount" BIGINT NOT NULL DEFAULT 0,
  "successRateBps" INTEGER,
  "p95LatencyMs" INTEGER,
  "lastLatencyMs" INTEGER,
  "openedAt" TIMESTAMPTZ(6),
  "cooldownUntil" TIMESTAMPTZ(6),
  "lastSuccessAt" TIMESTAMPTZ(6),
  "lastFailureAt" TIMESTAMPTZ(6),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_health_counts_check" CHECK ("consecutiveFailures" >= 0 AND "successCount" >= 0 AND "failureCount" >= 0),
  CONSTRAINT "provider_health_rate_check" CHECK ("successRateBps" IS NULL OR "successRateBps" BETWEEN 0 AND 10000),
  CONSTRAINT "provider_health_latency_check" CHECK ("p95LatencyMs" IS NULL OR "p95LatencyMs" >= 0),
  UNIQUE ("providerCode","capability")
);
CREATE INDEX "provider_capability_health_capability_state_idx" ON "provider_capability_health"("capability","circuitState");

CREATE TABLE "bill_customer_validations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "providerOfferId" UUID NOT NULL REFERENCES "bill_provider_offers"("id") ON DELETE RESTRICT,
  "providerCode" VARCHAR(40) NOT NULL,
  "providerProductCode" VARCHAR(160) NOT NULL,
  "customerIdentifierFingerprint" CHAR(64) NOT NULL,
  "customerIdentifierCiphertext" TEXT NOT NULL,
  "customerIdentifierLast4" VARCHAR(4) NOT NULL,
  "customerName" VARCHAR(180),
  "validationReferenceCiphertext" TEXT,
  "valid" BOOLEAN NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "bill_customer_validations_lookup_idx" ON "bill_customer_validations"("userId","providerOfferId","customerIdentifierFingerprint","expiresAt");

CREATE TABLE "bill_purchases" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "financialTransactionId" UUID NOT NULL UNIQUE REFERENCES "financial_transactions"("id") ON DELETE RESTRICT,
  "productId" UUID NOT NULL REFERENCES "bill_products"("id") ON DELETE RESTRICT,
  "providerOfferId" UUID NOT NULL REFERENCES "bill_provider_offers"("id") ON DELETE RESTRICT,
  "status" "BillPurchaseStatus" NOT NULL DEFAULT 'CREATED',
  "customerIdentifierCiphertext" TEXT NOT NULL,
  "customerIdentifierFingerprint" CHAR(64) NOT NULL,
  "customerIdentifierLast4" VARCHAR(4) NOT NULL,
  "contactPhoneCiphertext" TEXT,
  "amountMinor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "providerRequestReference" VARCHAR(160) NOT NULL,
  "providerReference" VARCHAR(160),
  "fulfillmentCiphertext" TEXT,
  "commissionMinor" BIGINT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "reconcileAttempts" INTEGER NOT NULL DEFAULT 0,
  "nextReconcileAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bill_purchases_amount_check" CHECK ("amountMinor" > 0 AND ("commissionMinor" IS NULL OR "commissionMinor" >= 0)),
  CONSTRAINT "bill_purchases_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "bill_purchases_attempts_check" CHECK ("attempts" >= 0 AND "reconcileAttempts" >= 0)
);
CREATE INDEX "bill_purchases_user_time_idx" ON "bill_purchases"("userId","createdAt");
CREATE INDEX "bill_purchases_status_time_idx" ON "bill_purchases"("status","nextReconcileAt","updatedAt");
CREATE INDEX "bill_purchases_offer_status_idx" ON "bill_purchases"("providerOfferId","status");
CREATE UNIQUE INDEX "bill_purchases_offer_request_ref_key" ON "bill_purchases"("providerOfferId","providerRequestReference");

CREATE TABLE "event_organizers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "name" VARCHAR(180) NOT NULL,
  "slug" VARCHAR(120) NOT NULL UNIQUE,
  "status" "EventOrganizerStatus" NOT NULL DEFAULT 'ACTIVE',
  "settlementLedgerAccountId" UUID NOT NULL UNIQUE REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "event_organizers_owner_status_idx" ON "event_organizers"("ownerUserId","status");

CREATE TABLE "events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizerId" UUID NOT NULL REFERENCES "event_organizers"("id") ON DELETE RESTRICT,
  "slug" VARCHAR(160) NOT NULL UNIQUE,
  "title" VARCHAR(220) NOT NULL,
  "description" TEXT,
  "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" CHAR(3) NOT NULL,
  "venueName" VARCHAR(220),
  "venueAddress" VARCHAR(500),
  "startsAt" TIMESTAMPTZ(6) NOT NULL,
  "endsAt" TIMESTAMPTZ(6),
  "salesStartsAt" TIMESTAMPTZ(6),
  "salesEndsAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "events_v1_ngn_check" CHECK ("currency" = 'NGN'),
  CONSTRAINT "events_time_check" CHECK (("endsAt" IS NULL OR "endsAt" > "startsAt") AND ("salesEndsAt" IS NULL OR "salesStartsAt" IS NULL OR "salesEndsAt" > "salesStartsAt"))
);
CREATE INDEX "events_organizer_status_start_idx" ON "events"("organizerId","status","startsAt");

CREATE TABLE "event_ticket_types" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId" UUID NOT NULL REFERENCES "events"("id") ON DELETE RESTRICT,
  "name" VARCHAR(160) NOT NULL,
  "priceMinor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "capacity" INTEGER NOT NULL,
  "status" "TicketTypeStatus" NOT NULL DEFAULT 'ACTIVE',
  "salesStartsAt" TIMESTAMPTZ(6),
  "salesEndsAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_ticket_types_price_check" CHECK ("priceMinor" > 0),
  CONSTRAINT "event_ticket_types_capacity_check" CHECK ("capacity" > 0),
  CONSTRAINT "event_ticket_types_currency_check" CHECK ("currency" = 'NGN'),
  CONSTRAINT "event_ticket_types_sales_time_check" CHECK ("salesEndsAt" IS NULL OR "salesStartsAt" IS NULL OR "salesEndsAt" > "salesStartsAt"),
  UNIQUE ("eventId","name")
);
CREATE INDEX "event_ticket_types_event_status_idx" ON "event_ticket_types"("eventId","status");

CREATE TABLE "event_orders" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reference" VARCHAR(100) NOT NULL UNIQUE,
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "eventId" UUID NOT NULL REFERENCES "events"("id") ON DELETE RESTRICT,
  "financialTransactionId" UUID NOT NULL UNIQUE REFERENCES "financial_transactions"("id") ON DELETE RESTRICT,
  "status" "EventOrderStatus" NOT NULL DEFAULT 'CREATED',
  "subtotalMinor" BIGINT NOT NULL,
  "platformFeeMinor" BIGINT NOT NULL,
  "totalMinor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "paidAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_orders_amount_check" CHECK ("subtotalMinor" >= 0 AND "platformFeeMinor" >= 0 AND "totalMinor" = "subtotalMinor" + "platformFeeMinor" AND "totalMinor" > 0),
  CONSTRAINT "event_orders_currency_check" CHECK ("currency" = 'NGN')
);
CREATE INDEX "event_orders_user_time_idx" ON "event_orders"("userId","createdAt");
CREATE INDEX "event_orders_event_status_expiry_idx" ON "event_orders"("eventId","status","expiresAt");

CREATE TABLE "event_order_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL REFERENCES "event_orders"("id") ON DELETE RESTRICT,
  "ticketTypeId" UUID NOT NULL REFERENCES "event_ticket_types"("id") ON DELETE RESTRICT,
  "quantity" INTEGER NOT NULL,
  "unitPriceMinor" BIGINT NOT NULL,
  "lineTotalMinor" BIGINT NOT NULL,
  CONSTRAINT "event_order_items_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "event_order_items_price_check" CHECK ("unitPriceMinor" >= 0 AND "lineTotalMinor" = "unitPriceMinor" * "quantity"),
  UNIQUE ("orderId","ticketTypeId")
);
CREATE INDEX "event_order_items_ticket_type_idx" ON "event_order_items"("ticketTypeId");

CREATE TABLE "event_tickets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "publicCode" VARCHAR(100) NOT NULL UNIQUE,
  "orderId" UUID NOT NULL REFERENCES "event_orders"("id") ON DELETE RESTRICT,
  "ticketTypeId" UUID NOT NULL REFERENCES "event_ticket_types"("id") ON DELETE RESTRICT,
  "status" "TicketStatus" NOT NULL DEFAULT 'ACTIVE',
  "credentialFingerprint" CHAR(64) NOT NULL UNIQUE,
  "credentialCiphertext" TEXT NOT NULL,
  "credentialKeyVersion" INTEGER NOT NULL DEFAULT 1,
  "issuedToName" VARCHAR(180),
  "issuedToEmail" VARCHAR(320),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "event_tickets_order_status_idx" ON "event_tickets"("orderId","status");

CREATE TABLE "ticket_check_ins" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticketId" UUID NOT NULL UNIQUE REFERENCES "event_tickets"("id") ON DELETE RESTRICT,
  "checkedInByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "requestId" VARCHAR(64),
  "checkedInAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ticket_check_ins_staff_time_idx" ON "ticket_check_ins"("checkedInByUserId","checkedInAt");

CREATE TABLE "notifications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "channel" "NotificationChannel" NOT NULL,
  "templateCode" VARCHAR(100) NOT NULL,
  "destinationCiphertext" TEXT NOT NULL,
  "destinationFingerprint" CHAR(64) NOT NULL,
  "destinationLast4" VARCHAR(4),
  "subject" VARCHAR(200),
  "bodyCiphertext" TEXT NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" VARCHAR(160) NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "notifications_status_time_idx" ON "notifications"("status","createdAt");
CREATE INDEX "notifications_user_time_idx" ON "notifications"("userId","createdAt");

CREATE TABLE "notification_attempts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "notificationId" UUID NOT NULL REFERENCES "notifications"("id") ON DELETE RESTRICT,
  "providerCode" VARCHAR(40) NOT NULL,
  "providerReference" VARCHAR(160),
  "status" "NotificationStatus" NOT NULL,
  "failureCode" VARCHAR(100),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "notification_attempts_notification_time_idx" ON "notification_attempts"("notificationId","createdAt");

-- Batch 3 adds one tightly-scoped internal settlement transition. Only an
-- EVENT_PURCHASE may move directly from FUNDS_RESERVED to SUCCEEDED because
-- no external payment provider is involved in wallet-funded event checkout.
CREATE OR REPLACE FUNCTION twipay_guard_financial_transaction_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'TwiPay financial transactions cannot be deleted'; END IF;
  IF NEW."reference" <> OLD."reference"
     OR NEW."userId" IS DISTINCT FROM OLD."userId" OR NEW."type" <> OLD."type"
     OR NEW."currency" <> OLD."currency" OR NEW."amountMinor" <> OLD."amountMinor"
     OR NEW."feeMinor" <> OLD."feeMinor" OR NEW."description" IS DISTINCT FROM OLD."description"
     OR NEW."metadata" IS DISTINCT FROM OLD."metadata" OR NEW."createdAt" <> OLD."createdAt"
  THEN RAISE EXCEPTION 'TwiPay financial transaction instruction fields are immutable'; END IF;
  IF NEW."status" = OLD."status" THEN RETURN NEW; END IF;
  IF (OLD."status" = 'CREATED' AND NEW."status" IN ('AUTHORIZED','FAILED','CANCELLED'))
     OR (OLD."status" = 'AUTHORIZED' AND NEW."status" IN ('FUNDS_RESERVED','PROVIDER_SUBMITTED','FAILED','CANCELLED'))
     OR (OLD."status" = 'FUNDS_RESERVED' AND NEW."status" IN ('PROVIDER_SUBMITTED','FAILED','CANCELLED'))
     OR (OLD."status" = 'FUNDS_RESERVED' AND NEW."status" = 'SUCCEEDED' AND OLD."type" = 'EVENT_PURCHASE'
         AND EXISTS (SELECT 1 FROM "journal_transactions" j WHERE j."financialTransactionId" = OLD."id" AND j."postedAt" IS NOT NULL))
     OR (OLD."status" = 'PROVIDER_SUBMITTED' AND NEW."status" IN ('PROCESSING','UNKNOWN','SUCCEEDED','FAILED','REVERSED'))
     OR (OLD."status" = 'PROCESSING' AND NEW."status" IN ('UNKNOWN','SUCCEEDED','FAILED','REVERSED'))
     OR (OLD."status" = 'UNKNOWN' AND NEW."status" IN ('PROCESSING','SUCCEEDED','FAILED','REVERSED'))
     OR (OLD."status" = 'SUCCEEDED' AND NEW."status" = 'REVERSED')
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Invalid TwiPay financial transaction transition % -> %', OLD."status", NEW."status";
END;
$$ LANGUAGE plpgsql;

-- Bill purchase rows must agree with the chosen offer/product and immutable financial instruction.
CREATE OR REPLACE FUNCTION twipay_validate_bill_purchase_insert() RETURNS trigger AS $$
DECLARE offer RECORD; product RECORD; fin RECORD;
BEGIN
  SELECT * INTO offer FROM "bill_provider_offers" WHERE "id" = NEW."providerOfferId";
  SELECT * INTO product FROM "bill_products" WHERE "id" = NEW."productId";
  SELECT * INTO fin FROM "financial_transactions" WHERE "id" = NEW."financialTransactionId";
  IF offer."productId" <> NEW."productId" THEN RAISE EXCEPTION 'bill purchase offer/product mismatch'; END IF;
  IF product."currency" <> NEW."currency" THEN RAISE EXCEPTION 'bill purchase product currency mismatch'; END IF;
  IF fin."type" <> 'BILL_PAYMENT' OR fin."userId" <> NEW."userId" OR fin."amountMinor" <> NEW."amountMinor" OR fin."currency" <> NEW."currency" THEN
    RAISE EXCEPTION 'bill purchase financial instruction mismatch';
  END IF;
  IF NEW."providerRequestReference" IS NULL OR length(trim(NEW."providerRequestReference")) = 0 THEN
    RAISE EXCEPTION 'bill purchase provider request reference is required before submission';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "bill_purchases_validate_insert" BEFORE INSERT ON "bill_purchases" FOR EACH ROW EXECUTE FUNCTION twipay_validate_bill_purchase_insert();

-- Service-purchase instruction fields are immutable after creation. State changes are one-way.
CREATE OR REPLACE FUNCTION twipay_guard_bill_purchase_update() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'bill purchases cannot be deleted'; END IF;
  IF NEW."userId" <> OLD."userId" OR NEW."financialTransactionId" <> OLD."financialTransactionId"
     OR NEW."productId" <> OLD."productId" OR NEW."providerOfferId" <> OLD."providerOfferId"
     OR NEW."customerIdentifierCiphertext" <> OLD."customerIdentifierCiphertext"
     OR NEW."customerIdentifierFingerprint" <> OLD."customerIdentifierFingerprint"
     OR NEW."amountMinor" <> OLD."amountMinor" OR NEW."currency" <> OLD."currency"
     OR NEW."providerRequestReference" <> OLD."providerRequestReference" THEN
    RAISE EXCEPTION 'bill purchase instruction is immutable';
  END IF;
  IF NEW."status" <> OLD."status" AND NOT (
    (OLD."status"='CREATED' AND NEW."status" IN ('VALIDATING','VALIDATED','FAILED','CANCELLED')) OR
    (OLD."status"='VALIDATING' AND NEW."status" IN ('VALIDATED','FAILED','CANCELLED')) OR
    (OLD."status"='VALIDATED' AND NEW."status" IN ('FUNDS_RESERVED','FAILED','CANCELLED')) OR
    (OLD."status"='FUNDS_RESERVED' AND NEW."status" IN ('PROVIDER_SUBMITTED','FAILED','CANCELLED')) OR
    (OLD."status"='PROVIDER_SUBMITTED' AND NEW."status" IN ('PROCESSING','UNKNOWN','SUCCEEDED','FAILED','REVERSED')) OR
    (OLD."status"='PROCESSING' AND NEW."status" IN ('UNKNOWN','SUCCEEDED','FAILED','REVERSED')) OR
    (OLD."status"='UNKNOWN' AND NEW."status" IN ('PROCESSING','SUCCEEDED','FAILED','REVERSED')) OR
    (OLD."status"='SUCCEEDED' AND NEW."status"='REVERSED')
  ) THEN RAISE EXCEPTION 'invalid bill purchase state transition'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "bill_purchases_guard_update" BEFORE UPDATE OR DELETE ON "bill_purchases" FOR EACH ROW EXECUTE FUNCTION twipay_guard_bill_purchase_update();

-- Event order financial instruction must agree with the event and financial transaction at creation.
CREATE OR REPLACE FUNCTION twipay_validate_event_order_insert() RETURNS trigger AS $$
DECLARE evt RECORD; fin RECORD;
BEGIN
  SELECT * INTO evt FROM "events" WHERE "id" = NEW."eventId";
  SELECT * INTO fin FROM "financial_transactions" WHERE "id" = NEW."financialTransactionId";
  IF evt."currency" <> NEW."currency" THEN RAISE EXCEPTION 'event order/event currency mismatch'; END IF;
  IF fin."type" <> 'EVENT_PURCHASE' OR fin."userId" <> NEW."userId" OR fin."amountMinor" <> NEW."totalMinor" OR fin."currency" <> NEW."currency" THEN
    RAISE EXCEPTION 'event order financial instruction mismatch';
  END IF;
  IF fin."feeMinor" <> NEW."platformFeeMinor" THEN
    RAISE EXCEPTION 'event order financial fee mismatch';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "event_orders_validate_insert" BEFORE INSERT ON "event_orders" FOR EACH ROW EXECUTE FUNCTION twipay_validate_event_order_insert();

-- Order lines can only be added while the order is still CREATED, must belong
-- to the same event, and must snapshot the authoritative ticket price.
CREATE OR REPLACE FUNCTION twipay_validate_event_order_item_insert() RETURNS trigger AS $$
DECLARE ord RECORD; tt RECORD;
BEGIN
  SELECT * INTO ord FROM "event_orders" WHERE "id" = NEW."orderId" FOR UPDATE;
  SELECT * INTO tt FROM "event_ticket_types" WHERE "id" = NEW."ticketTypeId";
  IF ord."status" <> 'CREATED' THEN RAISE EXCEPTION 'event order items may only be added to CREATED orders'; END IF;
  IF tt."eventId" <> ord."eventId" THEN RAISE EXCEPTION 'event order item ticket/event mismatch'; END IF;
  IF tt."currency" <> ord."currency" OR tt."priceMinor" <> NEW."unitPriceMinor" THEN
    RAISE EXCEPTION 'event order item price snapshot mismatch';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "event_order_items_validate_insert" BEFORE INSERT ON "event_order_items" FOR EACH ROW EXECUTE FUNCTION twipay_validate_event_order_item_insert();

-- An event order's priced instruction cannot be repriced after reservation/creation.
CREATE OR REPLACE FUNCTION twipay_guard_event_order_update() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'event orders cannot be deleted'; END IF;
  IF NEW."userId" <> OLD."userId" OR NEW."eventId" <> OLD."eventId" OR NEW."financialTransactionId" <> OLD."financialTransactionId"
     OR NEW."subtotalMinor" <> OLD."subtotalMinor" OR NEW."platformFeeMinor" <> OLD."platformFeeMinor"
     OR NEW."totalMinor" <> OLD."totalMinor" OR NEW."currency" <> OLD."currency" THEN
    RAISE EXCEPTION 'event order financial instruction is immutable';
  END IF;
  IF NEW."status" = 'PAID' AND OLD."status" <> 'PAID' AND NOT EXISTS (
    SELECT 1 FROM "financial_transactions" f WHERE f."id" = NEW."financialTransactionId" AND f."status" = 'SUCCEEDED'
  ) THEN RAISE EXCEPTION 'event order cannot become paid before financial settlement'; END IF;
  IF NEW."status" <> OLD."status" AND NOT (
    (OLD."status"='CREATED' AND NEW."status" IN ('FUNDS_RESERVED','FAILED','CANCELLED')) OR
    (OLD."status"='FUNDS_RESERVED' AND NEW."status" IN ('PAID','FAILED','CANCELLED'))
  ) THEN RAISE EXCEPTION 'invalid event order state transition'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "event_orders_guard_update" BEFORE UPDATE OR DELETE ON "event_orders" FOR EACH ROW EXECUTE FUNCTION twipay_guard_event_order_update();

CREATE OR REPLACE FUNCTION twipay_guard_event_order_item_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'event order items are immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "event_order_items_immutable" BEFORE UPDATE OR DELETE ON "event_order_items" FOR EACH ROW EXECUTE FUNCTION twipay_guard_event_order_item_mutation();

-- Tickets may only be issued for a paid order, for ticket types on that
-- order's event, and never beyond the purchased line quantity.
CREATE OR REPLACE FUNCTION twipay_validate_event_ticket_insert() RETURNS trigger AS $$
DECLARE ord RECORD; tt RECORD; purchased INTEGER; already_issued INTEGER;
BEGIN
  SELECT * INTO ord FROM "event_orders" WHERE "id" = NEW."orderId" FOR UPDATE;
  SELECT * INTO tt FROM "event_ticket_types" WHERE "id" = NEW."ticketTypeId";
  IF ord."status" <> 'PAID' THEN RAISE EXCEPTION 'tickets may only be issued for paid event orders'; END IF;
  IF tt."eventId" <> ord."eventId" THEN RAISE EXCEPTION 'event ticket type/order event mismatch'; END IF;
  SELECT "quantity" INTO purchased FROM "event_order_items" WHERE "orderId" = NEW."orderId" AND "ticketTypeId" = NEW."ticketTypeId";
  IF purchased IS NULL THEN RAISE EXCEPTION 'event ticket has no purchased order line'; END IF;
  SELECT count(*)::INTEGER INTO already_issued FROM "event_tickets" WHERE "orderId" = NEW."orderId" AND "ticketTypeId" = NEW."ticketTypeId";
  IF already_issued >= purchased THEN RAISE EXCEPTION 'event ticket issuance exceeds purchased quantity'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "event_tickets_validate_insert" BEFORE INSERT ON "event_tickets" FOR EACH ROW EXECUTE FUNCTION twipay_validate_event_ticket_insert();

CREATE OR REPLACE FUNCTION twipay_guard_ticket_update() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'event tickets cannot be deleted'; END IF;
  IF NEW."publicCode" <> OLD."publicCode" OR NEW."orderId" <> OLD."orderId" OR NEW."ticketTypeId" <> OLD."ticketTypeId"
     OR NEW."credentialFingerprint" <> OLD."credentialFingerprint" OR NEW."credentialCiphertext" <> OLD."credentialCiphertext"
     OR NEW."credentialKeyVersion" <> OLD."credentialKeyVersion"
     OR NEW."issuedToName" IS DISTINCT FROM OLD."issuedToName" OR NEW."issuedToEmail" IS DISTINCT FROM OLD."issuedToEmail" THEN
    RAISE EXCEPTION 'ticket credential/instruction is immutable';
  END IF;
  IF NEW."status" <> OLD."status" AND NOT (
    OLD."status"='ACTIVE' AND NEW."status" IN ('CHECKED_IN','CANCELLED','VOID')
  ) THEN RAISE EXCEPTION 'invalid ticket state transition'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "event_tickets_guard_update" BEFORE UPDATE OR DELETE ON "event_tickets" FOR EACH ROW EXECUTE FUNCTION twipay_guard_ticket_update();

CREATE OR REPLACE FUNCTION twipay_guard_ticket_check_in() RETURNS trigger AS $$
DECLARE ticket RECORD;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'ticket check-ins are immutable'; END IF;
  SELECT * INTO ticket FROM "event_tickets" WHERE "id" = NEW."ticketId" FOR UPDATE;
  IF ticket."status" <> 'ACTIVE' THEN RAISE EXCEPTION 'only active tickets may be checked in'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ticket_check_ins_guard" BEFORE INSERT OR UPDATE OR DELETE ON "ticket_check_ins" FOR EACH ROW EXECUTE FUNCTION twipay_guard_ticket_check_in();

CREATE OR REPLACE FUNCTION twipay_mark_ticket_checked_in() RETURNS trigger AS $$
BEGIN
  UPDATE "event_tickets" SET "status" = 'CHECKED_IN', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = NEW."ticketId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ticket_check_ins_mark_ticket" AFTER INSERT ON "ticket_check_ins" FOR EACH ROW EXECUTE FUNCTION twipay_mark_ticket_checked_in();

-- Settlement ledger accounts for organizers must be NGN credit-normal liabilities.
CREATE OR REPLACE FUNCTION twipay_validate_organizer_ledger() RETURNS trigger AS $$
DECLARE acc RECORD;
BEGIN
  SELECT * INTO acc FROM "ledger_accounts" WHERE "id" = NEW."settlementLedgerAccountId";
  IF acc."category" <> 'LIABILITY' OR acc."normalBalance" <> 'CREDIT' OR acc."currency" <> 'NGN'
     OR acc."system" <> TRUE OR acc."ownerUserId" IS NOT NULL THEN
    RAISE EXCEPTION 'organizer settlement ledger configuration mismatch';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "event_organizers_validate_ledger" BEFORE INSERT OR UPDATE OF "settlementLedgerAccountId" ON "event_organizers" FOR EACH ROW EXECUTE FUNCTION twipay_validate_organizer_ledger();
