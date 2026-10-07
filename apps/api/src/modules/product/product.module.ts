import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProductConfigService } from './application/product-config.service.js';
import { ProductController } from './presentation/product.controller.js';

@Module({ imports: [AuthModule], controllers: [ProductController], providers: [ProductConfigService], exports: [ProductConfigService] })
export class ProductModule {}
