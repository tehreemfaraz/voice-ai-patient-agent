import { NestFactory } from '@nestjs/core';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { ResponseInterceptor } from './common/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // No `enableImplicitConversion`: every field that needs coercing declares an explicit
      // `@Transform` in the DTO, and implicit conversion would silently re-coerce those results.
      // A request that parses but breaks a field rule is unprocessable, not malformed — 422.
      // 400 is left to genuinely malformed input (unparseable JSON, a non-UUID `:id` path param),
      // which keeps the two distinguishable for the caller.
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Voice AI patient agent API listening on port ${port}`);
}
void bootstrap();
