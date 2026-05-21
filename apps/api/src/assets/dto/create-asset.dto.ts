import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { AssetStatus, AssetType } from '@prisma/client';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateAssetDto {
  @IsEnum(AssetType)
  type!: AssetType;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  brand!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  model?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  valueCents?: number;

  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  notes?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  locationId?: string | null;
}
