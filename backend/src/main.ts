import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS cho Admin Panel, Chatbot Service và Landing (storefront)
  app.enableCors({
    origin: ['http://localhost:4000', 'http://localhost:8000', 'http://localhost:3001'],
    credentials: true,
  });

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
