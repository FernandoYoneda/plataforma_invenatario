import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { ReturnAssignmentDto } from './dto/return-assignment.dto';

@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get('active')
  findActive() {
    return this.assignmentsService.findActive();
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateAssignmentDto) {
    return this.assignmentsService.create(dto);
  }

  @Post(':id/return')
  @Roles(Role.ADMIN)
  returnAssignment(
    @Param('id') id: string,
    @Body() dto: ReturnAssignmentDto,
  ) {
    return this.assignmentsService.returnAssignment(id, dto);
  }
}
