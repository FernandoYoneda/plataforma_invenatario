import { Module } from '@nestjs/common';
import { AssignmentsModule } from '../assignments/assignments.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';

@Module({
  imports: [PrismaModule, AssignmentsModule],
  controllers: [AssetsController],
  providers: [AssetsService],
})
export class AssetsModule {}
