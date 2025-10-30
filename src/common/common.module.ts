// ============================================================================
// FILE: src/common/common.module.ts
// DESCRIPTION: Global Common Module for shared services
// ============================================================================

import { Global, Module } from '@nestjs/common';
import { AppLoggerService } from './logger/app-logger.service';
import { EmailService } from './services/email.service';
import { EmailQueueService } from './rabbitmq/email-queue.service';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';

@Global()
@Module({
  imports: [RabbitMQModule],
  providers: [AppLoggerService, EmailService, EmailQueueService],
  exports: [AppLoggerService, EmailService, EmailQueueService, RabbitMQModule],
})
export class CommonModule {}
