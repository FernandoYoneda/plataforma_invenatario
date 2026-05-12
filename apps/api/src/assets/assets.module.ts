import { Module } from '@nestjs/common';
import { AssignmentsModule } from '../assignments/assignments.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AssetsController } from './assets.controller';
import { AssetAttachmentsService } from './asset-attachments.service';
import { AssetsService } from './assets.service';

@Module({
  imports: [PrismaModule, AssignmentsModule, AuditLogsModule],
  controllers: [AssetsController],
  providers: [AssetsService, AssetAttachmentsService],
})
export class AssetsModule {}
