import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../platform/http/zod-validation.pipe.js';
import { SessionAuthGuard, requirePrincipal, type AuthenticatedFastifyRequest } from '../../auth/presentation/session-auth.guard.js';
import { KycService } from '../application/kyc.service.js';

const InitiateSchema = z.object({
  type: z.enum(['BVN', 'NIN']),
  identifier: z.string().regex(/^\d{11}$/),
  consent: z.literal(true),
  scope: z.enum(['identity', 'bank_accounts']).optional(),
}).strict();
const ContinueSchema = z.object({
  action: z.enum(['REQUEST_OTP', 'SUBMIT_OTP']),
  verificationMethod: z.string().trim().min(2).max(40).optional(),
  phoneNumber: z.string().regex(/^\+?\d{11,14}$/).optional(),
  otp: z.string().regex(/^\d{4,10}$/).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.action === 'REQUEST_OTP' && !value.verificationMethod) ctx.addIssue({ code: 'custom', message: 'verificationMethod is required' });
  if (value.action === 'SUBMIT_OTP' && !value.otp) ctx.addIssue({ code: 'custom', message: 'otp is required' });
});

function idem(value: string | undefined): string {
  if (!value) throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  return value;
}

@ApiTags('kyc')
@UseGuards(SessionAuthGuard)
@Controller('kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Post('verifications')
  async initiate(
    @Body(new ZodValidationPipe(InitiateSchema)) body: z.infer<typeof InitiateSchema>,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedFastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const principal = requirePrincipal(req);
    const result = await this.kyc.initiate({ userId: principal.userId, idempotencyKey: idem(key), ...body });
    res.status(result.statusCode);
    return result.body;
  }

  @Post('verifications/:id/continue')
  async continue(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ContinueSchema)) body: z.infer<typeof ContinueSchema>,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedFastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const principal = requirePrincipal(req);
    const result = await this.kyc.continue({ userId: principal.userId, verificationId: id, idempotencyKey: idem(key), ...body });
    res.status(result.statusCode);
    return result.body;
  }

  @Get('verifications')
  async status(@Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { verifications: await this.kyc.status(principal.userId) };
  }
}
