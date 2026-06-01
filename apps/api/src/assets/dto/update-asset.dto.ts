import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { AssetStatus, AssetType } from '@prisma/client';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function trimOptionalString(value: unknown) {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class UpdateAssetDto {
  @IsOptional()
  @IsEnum(AssetType)
  type?: AssetType;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  brand?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  model?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  valueCents?: number;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  purchaseDate?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  phoneNumber1?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  phoneNumber2?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  @Matches(/^\d{15}$/, {
    message: 'imei1 deve conter exatamente 15 digitos',
  })
  imei1?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimOptionalString(value))
  @IsString()
  @Matches(/^\d{15}$/, {
    message: 'imei2 deve conter exatamente 15 digitos',
  })
  imei2?: string | null;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  carrier?: string | null;

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
