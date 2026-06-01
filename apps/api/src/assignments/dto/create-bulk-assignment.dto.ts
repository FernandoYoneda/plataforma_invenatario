import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeAssetIds(value: unknown) {
  if (!Array.isArray(value)) return value;

  return value.map((item) => trimString(item));
}

export class CreateBulkAssignmentDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @Transform(({ value }) => normalizeAssetIds(value))
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  assetIds!: string[];

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  notes?: string;
}
