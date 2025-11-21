import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { EmailWorkerModule } from './email-worker.module';

async function bootstrap() {
  const rabbitmqUrl =
    process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5889';
  console.log(`📨 Connecting to RabbitMQ: ${rabbitmqUrl}`);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    EmailWorkerModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [rabbitmqUrl],
        queue: 'email-queue',
        queueOptions: { durable: true },
        noAck: false,
        prefetchCount: 1,
      },
    },
  );

  await app.listen();
  console.log('📨 Email worker microservice is running and listening...');
}
bootstrap();
