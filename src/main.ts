// ============================================================================
// FILE: src/main.ts
// DESCRIPTION: Terracore Backend Bootstrap (HTTP + RabbitMQ Microservice)
// ============================================================================

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { Transport } from '@nestjs/microservices';

import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { AppLoggerService } from './common/logger/app-logger.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const appLogger = app.get(AppLoggerService);
  app.useLogger(appLogger);

  // ✅ Set global API prefix
  const globalPrefix = 'api/v1';
  app.setGlobalPrefix(globalPrefix);

  // ✅ Connect RabbitMQ microservice (port 5889)
  const rabbitUrl =
    configService.get<string>('RABBITMQ_URL') ||
    'amqp://guest:guest@localhost:5889';

  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitUrl],
      queue: 'email-queue',
      queueOptions: { durable: true },
      noAck: false,
      prefetchCount: 1,
    },
  });

  // ✅ Global filters and interceptors
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(appLogger));

  // ✅ Validation pipeline
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ✅ Enable CORS
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', '*').split(','),
    credentials: true,
  });

  // 📘 Swagger Docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('TerraCore API')
    .setDescription('REST API documentation for Terracore backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    swaggerOptions: { persistAuthorization: true },
    useGlobalPrefix: false,
  });

  // ❤️ Health Check
  const expressApp = app.getHttpAdapter().getInstance() as unknown as {
    get: (path: string, handler: (req: Request, res: Response) => void) => void;
  };
  expressApp.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      rabbitmq: rabbitUrl,
    });
  });

  // ▶️ Start both HTTP and Microservices
  await app.startAllMicroservices();
  logger.log('📨 RabbitMQ Email Consumer started on queue: email-queue');

  const port = configService.get<number>('APP_PORT', 3000);
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Terracore API running at: http://localhost:${port}/${globalPrefix}`);
  logger.log(`Swagger docs available at: http://localhost:${port}/docs`);
}
bootstrap().catch((err) => {
  console.error('❌ Application failed to start:', err);
  process.exit(1);
});
