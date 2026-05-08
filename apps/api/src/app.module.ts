import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AssetsModule } from "./assets/assets.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // <-- importante
    PrismaModule,
    AssetsModule,
    AuthModule,
  ],
})
export class AppModule {}
