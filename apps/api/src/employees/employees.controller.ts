import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

type AuthenticatedRequest = {
  user?: {
    id?: string;
  };
};

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll(@Query('status') status?: string) {
    return this.employeesService.findAll(status);
  }

  @Get(':id/assignments')
  findAssignments(@Param('id') id: string) {
    return this.employeesService.findAssignments(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.TI)
  create(@Body() dto: CreateEmployeeDto, @Req() req: AuthenticatedRequest) {
    return this.employeesService.create(dto, req.user?.id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.TI)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.employeesService.update(id, dto, req.user?.id);
  }

  @Patch(':id/inactivate')
  @Roles(Role.ADMIN, Role.TI)
  inactivate(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.employeesService.inactivate(id, req.user?.id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.TI)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.employeesService.inactivate(id, req.user?.id);
  }
}
