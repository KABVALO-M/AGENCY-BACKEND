// src/common/rabbitmq/rabbitmq.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EmailQueueService } from './email-queue.service';
// import { EmailQueueConsumer } from './email-queue.consumer';

@Module({
  imports: [
    ConfigModule,
    ClientsModule.registerAsync([
      {
        name: 'EMAIL_QUEUE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: async (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              configService.get<string>('RABBITMQ_URL') ||
                'amqp://guest:guest@localhost:5889',
            ],
            queue: 'email-queue',
            queueOptions: { durable: true },
            persistent: true, // Ensure messages are persisted
          },
        }),
      },
    ]),
  ],
//   controllers: [EmailQueueConsumer],
  providers: [EmailQueueService],
  exports: [ClientsModule, EmailQueueService],
})
export class RabbitMQModule {}