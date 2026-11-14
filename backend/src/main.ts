import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Behind a reverse proxy / load balancer the client's address arrives in
  // X-Forwarded-For. TRUST_PROXY says how many proxy hops to trust (e.g. "1"),
  // so rate limiting sees real client IPs instead of the proxy's.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    app.set(
      'trust proxy',
      /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true',
    );
  }
  app.use(cookieParser());
  app.use(
    helmet({
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  // whitelist strips properties that have no validation decorator, which
  // blocks mass-assignment of server-controlled fields (e.g. createdByUserId).
  // transform applies the DTOs' own normalisation (e.g. trimming names).
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Interactive API docs are a development aid, not something to publish.
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('SportProgression')
      .setDescription('The SportProgression API description')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
  }
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.DB_SYNCHRONIZE !== 'true'
  ) {
    new Logger('Bootstrap').warn(
      'Schema auto-sync is off in production. After deploying a version that ' +
        'changes the database schema, run once with DB_SYNCHRONIZE=true (after ' +
        'a backup) or apply the change with a migration.',
    );
  }
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  console.error(err);
});
