import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

/**
 * Google OIDC boundary.
 *
 * Batch 1 deliberately keeps protocol state (state + PKCE verifier) server-side.
 * The concrete openid-client flow is activated only after Google client credentials
 * exist in the deployment environment and its callback can be integration-tested.
 */
@Injectable()
export class GoogleOidcService {
  createTransaction() {
    return {
      state: randomBytes(24).toString('base64url'),
      codeVerifier: randomBytes(32).toString('base64url'),
      createdAt: new Date(),
    };
  }
}
