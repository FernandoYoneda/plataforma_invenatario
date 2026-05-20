import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

type AuthenticatedRequest = {
  user?: {
    id?: string;
  };
};

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query('status') status?: string) {
    return this.usersService.findAll(status);
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  create(@Body() dto: CreateUserDto, @Req() req: AuthenticatedRequest) {
    return this.usersService.create(dto, req.user?.id);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: AuthenticatedRequest) {
    return this.usersService.update(id, dto, req.user?.id);
  }

  @Patch(':id/inactivate')
  inactivate(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.inactivate(id, req.user?.id);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.activate(id, req.user?.id);
  }

  @Patch(':id/reset-password')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.resetPassword(id, dto, req.user?.id);
  }
}
