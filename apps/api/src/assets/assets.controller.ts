import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Query,
  Patch,
  Delete,
} from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { FindAssetsQueryDto } from './dto/find-assets-query.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  create(@Body() dto: CreateAssetDto) {
    return this.assetsService.create(dto);
  }

  @Get()
  findAll(@Query() query: FindAssetsQueryDto) {
    return this.assetsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assetsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.assetsService.update(id, dto);
  }
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.assetsService.remove(id);
  }
}
