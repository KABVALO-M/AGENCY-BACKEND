import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailQueueConsumer } from '../common/rabbitmq/email-queue.consumer';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [EmailQueueConsumer],
})
export class EmailWorkerModule {}
