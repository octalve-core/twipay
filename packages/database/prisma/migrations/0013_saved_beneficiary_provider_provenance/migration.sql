-- Historical saved recipients have no authenticated provider provenance: keep NULL, require re-verification.
ALTER TABLE "beneficiaries" ADD COLUMN "providerCode" VARCHAR(40);
