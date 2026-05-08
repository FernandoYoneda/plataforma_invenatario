import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateAssignmentDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  assetId!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  notes?: string;
}
