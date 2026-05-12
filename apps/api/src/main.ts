import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';

function parseCorsOrigins(value?: string) {
  return (
    value
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  );
}

function isLocalhostOrigin(origin: string) {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]'
    );
  } catch {
    return false;
  }
}

function buildCorsOrigin(configService: ConfigService) {
  const configuredOrigins = parseCorsOrigins(
    configService.get<string>('CORS_ORIGIN'),
  );
  const allowLocalhost = configService.get<string>('NODE_ENV') !== 'production';

  return (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void,
  ) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (
      configuredOrigins.includes(origin) ||
      (allowLocalhost && isLocalhostOrigin(origin))
    ) {
      callback(null, true);
      return;
    }

    callback(new Error('Origem nao permitida pelo CORS'), false);
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.enableCors({
    origin: buildCorsOrigin(configService),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  await app.listen(Number(configService.get<string>('PORT') ?? 3000));
}

bootstrap();
