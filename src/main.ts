import { NestFactory } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { AppLoggerService } from './common/logger/app-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const appLogger = app.get(AppLoggerService);
  app.useLogger(appLogger);

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(appLogger));
  const globalPrefix = 'api/v1';
  app.setGlobalPrefix(globalPrefix, {
    exclude: [
      { path: 'docs', method: RequestMethod.ALL },
      { path: 'docs-json', method: RequestMethod.ALL },
    ],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('TerraCore API')
    .setDescription('REST API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    useGlobalPrefix: false,
  });

  const port = process.env.APP_PORT ?? process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  const appUrl = await app.getUrl();
  const normalizedUrl = appUrl
    .replace('0.0.0.0', 'localhost')
    .replace('[::1]', 'localhost')
    .replace('127.0.0.1', 'localhost')
    .replace(/\/$/, '');

  appLogger.setContext('Bootstrap');
  appLogger.info(`Application is running on: ${normalizedUrl}`);
  appLogger.info(`API base path: ${normalizedUrl}/${globalPrefix}`);
  appLogger.info(`Swagger docs: ${normalizedUrl}/docs`);
  appLogger.setContext('AppLogger');
}
bootstrap();
