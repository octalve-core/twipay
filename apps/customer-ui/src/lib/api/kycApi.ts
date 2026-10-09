import api from "./axios";

// Only fields returned by the inspected TwiPay KYC controller/service.
export type IdentityType = "BVN" | "NIN";
export type IdentityStatus = "CREATED" | "AWAITING_CONSENT" | "PENDING" | "VERIFIED" | "FAILED" | "EXPIRED";
export type IdentityVerification = {
  id: string;
  type: IdentityType;
  status: IdentityStatus;
  identifierLast4: string;
  providerCode: string;
  verificationMethods: string[];
  otpRequested: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type IdentityInitiation = {
  verificationId: string;
  type?: IdentityType;
  status: IdentityStatus;
  verificationMethods?: unknown[];
  code?: string;
  reused?: boolean;
};
export type IdentityContinuation = Pick<IdentityInitiation, "verificationId" | "type" | "status" | "code">;

export async function getIdentityVerifications(): Promise<IdentityVerification[]> {
  const response = await api.get<{verifications: IdentityVerification[]}>("/kyc/verifications");
  return response.data.verifications;
}

export async function initiateIdentityVerification(input: {
  type: IdentityType;
  identifier: string;
  consent: true;
  idempotencyKey: string;
}): Promise<IdentityInitiation> {
  const response = await api.post<IdentityInitiation>("/kyc/verifications", {
    type: input.type,
    identifier: input.identifier,
    consent: true,
    scope: "identity",
  }, {headers: {"Idempotency-Key": input.idempotencyKey}});
  return response.data;
}

export async function continueIdentityVerification(input: {
  verificationId: string;
  action: "REQUEST_OTP" | "SUBMIT_OTP";
  verificationMethod?: string;
  otp?: string;
  idempotencyKey: string;
}): Promise<IdentityContinuation> {
  const response = await api.post<IdentityContinuation>(
    `/kyc/verifications/${encodeURIComponent(input.verificationId)}/continue`,
    {
      action: input.action,
      ...(input.verificationMethod ? {verificationMethod: input.verificationMethod} : {}),
      ...(input.otp ? {otp: input.otp} : {}),
    },
    {headers: {"Idempotency-Key": input.idempotencyKey}},
  );
  return response.data;
}
