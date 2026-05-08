import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class ReturnAssignmentDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  notes?: string;
}
