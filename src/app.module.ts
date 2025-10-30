// ============================================================================
// FILE: src/app.module.ts
// DESCRIPTION: Main Terracore Application Module
// ============================================================================

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getOrmConfig } from './config/ormconfig';
import { CommonModule } from './common/common.module';
import { RolesModule } from './modules/roles/roles.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailWorkerModule } from './email-worker/email-worker.module';

@Module({
  imports: [
    // 🌍 Environment variables (global)
    ConfigModule.forRoot({ isGlobal: true }),

    // 🗄️ Database connection (async factory)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getOrmConfig,
    }),

    // ⚙️ Shared/global providers (logger, email queue, etc.)
    CommonModule,

    // 🔐 Core modules
    RolesModule,
    AuthModule,

    // 📨 Email worker microservice
    EmailWorkerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
