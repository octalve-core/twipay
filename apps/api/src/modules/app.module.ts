import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PrismaService } from '../platform/database/prisma.service.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: process.env.NODE_ENV === 'production' }), HealthModule, AuthModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
