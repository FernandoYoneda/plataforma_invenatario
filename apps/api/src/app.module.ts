import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AssetsModule } from "./assets/assets.module";
import { AuthModule } from "./auth/auth.module";
import { EmployeesModule } from "./employees/employees.module";
import { CategoriesModule } from "./categories/categories.module";
import { LocationsModule } from "./locations/locations.module";
import { AssignmentsModule } from "./assignments/assignments.module";
import { AuditLogsModule } from "./audit-logs/audit-logs.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // <-- importante
    PrismaModule,
    AssetsModule,
    AuthModule,
    EmployeesModule,
    CategoriesModule,
    LocationsModule,
    AssignmentsModule,
    AuditLogsModule,
    UsersModule,
  ],
})
export class AppModule {}
