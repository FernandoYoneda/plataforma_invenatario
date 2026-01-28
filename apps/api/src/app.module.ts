import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AssetsModule } from "./assets/assets.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // <-- importante
    PrismaModule,
    AssetsModule,
  ],
})
export class AppModule {}
