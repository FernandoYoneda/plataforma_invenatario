import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { AssetStatus, AssetType } from "@prisma/client";

export class CreateAssetDto {
  @IsEnum(AssetType)
  type!: AssetType;

  @IsString()
  brand!: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  // valor em centavos (ex: 350000 = R$ 3.500,00)
  @IsOptional()
  @IsInt()
  @Min(0)
  valueCents?: number;

  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
