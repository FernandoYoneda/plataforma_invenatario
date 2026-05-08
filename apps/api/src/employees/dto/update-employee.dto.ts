import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  department?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  position?: string;
}
