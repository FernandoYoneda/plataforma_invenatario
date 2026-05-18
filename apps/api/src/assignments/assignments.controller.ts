import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { ReturnAssignmentDto } from './dto/return-assignment.dto';

type AuthenticatedRequest = {
  user?: {
    id?: string;
  };
};

@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get('active')
  findActive() {
    return this.assignmentsService.findActive();
  }

  @Post()
  @Roles(Role.ADMIN, Role.TI)
  create(@Body() dto: CreateAssignmentDto, @Req() req: AuthenticatedRequest) {
    return this.assignmentsService.create(dto, req.user?.id);
  }

  @Post(':id/return')
  @Roles(Role.ADMIN, Role.TI)
  returnAssignment(
    @Param('id') id: string,
    @Body() dto: ReturnAssignmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.assignmentsService.returnAssignment(id, dto, req.user?.id);
  }
}
