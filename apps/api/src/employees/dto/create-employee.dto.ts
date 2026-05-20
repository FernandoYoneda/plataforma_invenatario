import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateEmployeeDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Transform(({ value }) => trimString(value))
  @IsEmail()
  email!: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  department?: string;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  position?: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  locationId?: string;
}
