import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";

enum AssetStatus {
  EM_USO = "EM_USO",
  ESTOQUE = "ESTOQUE",
  MANUTENCAO = "MANUTENCAO",
  BAIXADO = "BAIXADO",
}

enum AssetType {
  DESKTOP = "DESKTOP",
  NOTEBOOK = "NOTEBOOK",
  MONITOR = "MONITOR",
  MOUSE = "MOUSE",
  TECLADO = "TECLADO",
  OUTRO = "OUTRO",
}

export class UpdateAssetDto {
  @IsOptional()
  @IsEnum(AssetType)
  type?: AssetType;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  valueCents?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
