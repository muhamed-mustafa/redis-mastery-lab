import { NestFactory } from "@nestjs/core";
import "reflect-metadata";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 8000);
}

void bootstrap();
