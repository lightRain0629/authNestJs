import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';

// TODO DONT FORGET TO ADD AUTH FROM GOOGLE AND YANDEX, IVE ADDED auth/google endpoint

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  
  // Включаем глобальную валидацию
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Удаляет свойства, не указанные в DTO
    forbidNonWhitelisted: false, // Выбрасывает ошибку при лишних свойствах
    transform: true, // Автоматически преобразует типы
  }));
  
  await app.listen(3000);
}
bootstrap();
