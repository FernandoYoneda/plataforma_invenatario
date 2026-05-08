import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AssetsModule } from "./assets/assets.module";
import { AuthModule } from "./auth/auth.module";
import { CategoriesModule } from "./categories/categories.module";
import { LocationsModule } from "./locations/locations.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // <-- importante
    PrismaModule,
    AssetsModule,
    AuthModule,
    CategoriesModule,
    LocationsModule,
  ],
})
export class AppModule {}
