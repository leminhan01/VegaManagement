import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Chỉ cho phép các browser app đã biết gọi API. Bỏ dấu / cuối để tránh
  // cấu hình production vô tình không khớp với header Origin của trình duyệt.
  const requiredCorsOrigins = [
    'https://admin.lmnhan.io.vn',
    'https://lmnshop.lmnhan.io.vn',
  ];
  const configuredCorsOrigins = (
    process.env.CORS_ORIGINS ??
    'http://localhost:4000,http://localhost:3001'
  ).split(',');
  const corsOrigins = new Set(
    [...requiredCorsOrigins, ...configuredCorsOrigins]
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean),
  );

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      // Request server-to-server không có Origin và không thuộc CORS.
      const normalizedOrigin = origin?.replace(/\/$/, '');
      const isAllowed = !normalizedOrigin || corsOrigins.has(normalizedOrigin);

      if (!isAllowed) {
        Logger.warn(`Blocked CORS origin: ${normalizedOrigin}`, 'Bootstrap');
      }

      callback(null, isAllowed);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Authorization', 'Content-Type', 'X-API-Key'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 86400,
    optionsSuccessStatus: 204,
  });

  Logger.log(
    `CORS origins: ${Array.from(corsOrigins).join(', ')}`,
    'Bootstrap',
  );

  // Global prefix cho tất cả routes
  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('VegiFlow Backend API')
    .setDescription(
      'API documentation for the vegetarian food store admin panel and chatbot internal API.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Admin JWT access token',
      },
      'access_token',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'Bot internal API key',
      },
      'BOT_API_KEY',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Validation pipe cho tất cả DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Swagger docs available at http://localhost:${port}/api/docs`);
  console.log(`🚀 VegiFlow Backend running on http://localhost:${port}`);
}
bootstrap();
