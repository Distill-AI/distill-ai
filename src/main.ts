import './instrument'; // must be first — Sentry patches Node internals at init; instrument.ts must never transitively import @Injectable/@Module classes (reflect-metadata not yet loaded)
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { env } from './config/env';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: env.CORS_ORIGIN });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());

  if (env.SWAGGER_ENABLED) {
    const config = new DocumentBuilder()
      .setTitle('NestJS Starter API')
      .setDescription(
        'Fullstack NestJS starter — replace this description with your project details',
      )
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(env.PORT);

  console.log(`Application running on http://localhost:${env.PORT}`);
  if (env.SWAGGER_ENABLED) {
    console.log(`Swagger docs at http://localhost:${env.PORT}/api/docs`);
  }
}

void bootstrap();
