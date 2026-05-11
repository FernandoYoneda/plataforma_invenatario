import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Query,
  Patch,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AssignmentsService } from '../assignments/assignments.service';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { FindAssetsQueryDto } from './dto/find-assets-query.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

type AuthenticatedRequest = {
  user?: {
    id?: string;
  };
};

@Controller('assets')
@UseGuards(JwtAuthGuard)
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly assignmentsService: AssignmentsService,
  ) {}

  @Post()
  create(@Body() dto: CreateAssetDto, @Req() req: AuthenticatedRequest) {
    return this.assetsService.create(dto, req.user?.id);
  }

  @Get()
  findAll(@Query() query: FindAssetsQueryDto) {
    return this.assetsService.findAll(query);
  }

  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.assignmentsService.findAssetHistory(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assetsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.assetsService.update(id, dto, req.user?.id);
  }
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.assetsService.remove(id);
  }
}
