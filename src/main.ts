import 'dotenv/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as dns from 'dns';
import { ApiErrorFilter } from './common/api-error.filter';

async function bootstrap() {
  dns.setDefaultResultOrder('ipv4first');

  if (!process.env.JWT_SECRET) {
    console.error(
      '❌ FATAL: JWT_SECRET environment variable is not set. Server cannot start.',
    );
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new ApiErrorFilter());
  if (
    process.env.NODE_ENV === 'production' &&
    !['smtp', 'resend'].includes(process.env.SMTP_PROVIDER || '')
  )
    console.warn(
      'EMAIL_NOT_CONFIGURED: Set SMTP_PROVIDER and the provider credentials in Render. Mock email cannot deliver verification codes.',
    );

  // 1. HTTP Security Headers
  app.use(helmet({ crossOriginResourcePolicy: false }));

  // 2. Strict Production CORS Protection
  const allowedOrigins = [
    'https://nakathata.lk',
    'https://www.nakathata.lk',
    // Keep the existing deployment working during the domain cutover.
    'https://luxeevents.fun',
    'https://www.luxeevents.fun',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV !== 'production'
      ) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Recaptcha-Token'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // 3. Hide Swagger documentation in production
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Nakathata.lk API')
      .setDescription('The Nakathata.lk API description')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, documentFactory);
  }

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
