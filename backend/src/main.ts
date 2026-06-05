import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS cho Admin Panel và Chatbot Service
  app.enableCors({
    origin: ['http://localhost:4000', 'http://localhost:8000'],
    credentials: true,
  });

  // Global prefix cho tất cả routes
  app.setGlobalPrefix('api');

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
  console.log(`🚀 VegiFlow Backend running on http://localhost:${port}`);
}
bootstrap();
