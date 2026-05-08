import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AssetStatus, AssetType } from '@prisma/client';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class FindAssetsQueryDto {
  @IsOptional()
  @IsEnum(AssetType)
  type?: AssetType;

  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  brand?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  q?: string;
}
