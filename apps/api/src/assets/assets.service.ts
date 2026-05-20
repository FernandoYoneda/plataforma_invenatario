import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AssetStatus, AssetType, Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { FindAssetsQueryDto } from './dto/find-assets-query.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

type AssetWithRelations = Prisma.AssetGetPayload<{
  include: {
    category: true;
    location: true;
  };
}>;

type AssetImportField =
  | 'internalCode'
  | 'type'
  | 'brand'
  | 'model'
  | 'serialNumber'
  | 'valueCents'
  | 'notes'
  | 'categoryName'
  | 'locationName'
  | 'status';

type AssetImportMapping = Partial<Record<AssetImportField, string>>;

type AssetImportError = {
  rowNumber: number;
  code?: string | null;
  message: string;
};

type AssetImportResult = {
  totalRows: number;
  importedCount: number;
  ignoredCount: number;
  errors: AssetImportError[];
  imported: AssetWithRelations[];
};

const FIELD_ALIASES: Record<AssetImportField, string[]> = {
  internalCode: ['codigo', 'código', 'codigo interno', 'código interno'],
  type: ['tipo'],
  brand: ['marca'],
  model: ['modelo'],
  serialNumber: ['serial', 'serial number', 'numero de serie', 'número de série'],
  valueCents: ['valor', 'valor r$', 'valor (r$)', 'preco', 'preço'],
  notes: ['observacoes', 'observações', 'observacao', 'observação', 'obs'],
  categoryName: ['categoria'],
  locationName: ['localizacao', 'localização', 'local'],
  status: ['status'],
};

@Injectable()
export class AssetsService {
  constructor(
    private prisma: PrismaService,
    @Optional() private readonly auditLogs?: AuditLogsService,
  ) {}

  private readonly typedAssets = new Set<AssetType>([
    AssetType.DESKTOP,
    AssetType.NOTEBOOK,
    AssetType.MONITOR,
  ]);

  private trimToNull(value?: string | null) {
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private trimToUndefined(value?: string | null) {
    if (typeof value !== 'string') return undefined;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private trimToNullishId(value?: string | null) {
    if (value === undefined) return undefined;
    if (value === null) return null;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private describeAsset(asset: {
    internalCode: string;
    brand: string;
    model?: string | null;
  }) {
    const details = [asset.brand, asset.model].filter(Boolean).join(' ');
    return details
      ? `Ativo ${asset.internalCode} — ${details}`
      : `Ativo ${asset.internalCode}`;
  }

  private normalizeText(value: unknown) {
    if (value === undefined || value === null) return '';

    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private parseMoneyToCents(value: unknown) {
    const text = this.trimToUndefined(typeof value === 'string' ? value : String(value ?? ''));
    if (!text) return null;

    const normalized = text.includes(',')
      ? text.replace(/\./g, '').replace(',', '.')
      : text;
    const parsed = Number(normalized);

    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }

    return Math.round(parsed * 100);
  }

  private parseAssetType(value: unknown) {
    const normalized = this.normalizeText(value)
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (
      normalized === 'desktop' ||
      normalized === 'computador' ||
      normalized === 'computador desktop' ||
      normalized === 'pc'
    ) {
      return AssetType.DESKTOP;
    }

    if (normalized === 'notebook' || normalized === 'laptop') {
      return AssetType.NOTEBOOK;
    }

    if (normalized === 'monitor') {
      return AssetType.MONITOR;
    }

    if (normalized === 'mouse') {
      return AssetType.MOUSE;
    }

    if (normalized === 'teclado' || normalized === 'keyboard') {
      return AssetType.TECLADO;
    }

    if (normalized === 'outro' || normalized === 'other') {
      return AssetType.OUTRO;
    }

    return null;
  }

  private parseAssetStatus(value: unknown) {
    const normalized = this.normalizeText(value)
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (normalized === 'em uso' || normalized === 'em_uso') {
      return AssetStatus.EM_USO;
    }

    if (normalized === 'estoque') {
      return AssetStatus.ESTOQUE;
    }

    if (normalized === 'manutencao' || normalized === 'manutenção') {
      return AssetStatus.MANUTENCAO;
    }

    if (normalized === 'baixado') {
      return AssetStatus.BAIXADO;
    }

    return null;
  }

  private parseImportMapping(mapping?: string | null): AssetImportMapping {
    if (!mapping) {
      return {};
    }

    try {
      const parsed = JSON.parse(mapping) as Record<string, unknown>;
      const result: AssetImportMapping = {};

      for (const key of Object.keys(FIELD_ALIASES) as AssetImportField[]) {
        const rawValue = parsed[key];
        if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
          result[key] = rawValue.trim();
        }
      }

      return result;
    } catch {
      throw new BadRequestException('mapping invalido');
    }
  }

  private normalizeHeader(value: string) {
    return this.normalizeText(value);
  }

  private inferHeader(
    headers: string[],
    field: AssetImportField,
    mapping: AssetImportMapping,
  ) {
    const mapped = mapping[field];
    if (mapped) {
      const exact = headers.find((header) => header === mapped);
      if (exact) return exact;

      const normalizedMapped = this.normalizeHeader(mapped);
      const normalizedMatch = headers.find(
        (header) => this.normalizeHeader(header) === normalizedMapped,
      );
      if (normalizedMatch) return normalizedMatch;
    }

    const aliases = [field, ...FIELD_ALIASES[field]];
    return headers.find((header) =>
      aliases.some((alias) => this.normalizeHeader(header) === this.normalizeHeader(alias)),
    );
  }

  private readSpreadsheetRows(file: {
    buffer?: Buffer;
    originalname?: string;
  }) {
    if (!file.buffer || !file.originalname) {
      throw new BadRequestException('Arquivo para importacao e obrigatorio');
    }

    const isCsv = file.originalname.toLowerCase().endsWith('.csv');
    const workbook = isCsv
      ? XLSX.read(file.buffer.toString('utf8'), { type: 'string' })
      : XLSX.read(file.buffer, { type: 'buffer' });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('Arquivo sem planilha valida');
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    const headers = (rawRows[0] ?? []).map((value, index) => {
      const header = String(value ?? '').trim();
      return header || `COLUNA_${index + 1}`;
    });

    const rows = rawRows.slice(1).map((values) => {
      const record: Record<string, string> = {};

      headers.forEach((header, index) => {
        record[header] = String(values?.[index] ?? '').trim();
      });

      return record;
    });

    return { headers, rows };
  }

  private resolveEntityIdByName(
    value: string,
    lookup: Map<string, string>,
  ) {
    const normalized = this.normalizeHeader(value);
    return lookup.get(normalized) ?? null;
  }

  async importAssets(
    file: { buffer?: Buffer; originalname?: string } | undefined,
    mappingJson?: string,
    userId?: string | null,
  ): Promise<AssetImportResult> {
    if (!file?.buffer || !file.originalname) {
      throw new BadRequestException('Arquivo para importacao e obrigatorio');
    }

    const mapping = this.parseImportMapping(mappingJson);
    const { headers, rows } = this.readSpreadsheetRows(file);

    if (headers.length === 0 || rows.length === 0) {
      throw new BadRequestException('Arquivo precisa conter cabecalho e linhas de dados');
    }

    const resolved = {
      internalCode: this.inferHeader(headers, 'internalCode', mapping),
      type: this.inferHeader(headers, 'type', mapping),
      brand: this.inferHeader(headers, 'brand', mapping),
      model: this.inferHeader(headers, 'model', mapping),
      serialNumber: this.inferHeader(headers, 'serialNumber', mapping),
      valueCents: this.inferHeader(headers, 'valueCents', mapping),
      notes: this.inferHeader(headers, 'notes', mapping),
      categoryName: this.inferHeader(headers, 'categoryName', mapping),
      locationName: this.inferHeader(headers, 'locationName', mapping),
      status: this.inferHeader(headers, 'status', mapping),
    };

    const missingRequired = (Object.entries({
      Codigo: resolved.internalCode,
      Tipo: resolved.type,
      Marca: resolved.brand,
      Modelo: resolved.model,
    }) as Array<[string, string | undefined]>).filter(([, value]) => !value);

    if (missingRequired.length > 0) {
      throw new BadRequestException(
        `Colunas obrigatorias ausentes: ${missingRequired.map(([label]) => label).join(', ')}`,
      );
    }

    const [categories, locations, existingAssets] = await Promise.all([
      this.prisma.category.findMany({ select: { id: true, name: true } }),
      this.prisma.location.findMany({ select: { id: true, name: true } }),
      this.prisma.asset.findMany({ select: { internalCode: true } }),
    ]);

    const categoryLookup = new Map(
      categories.map((item) => [this.normalizeHeader(item.name), item.id]),
    );
    const locationLookup = new Map(
      locations.map((item) => [this.normalizeHeader(item.name), item.id]),
    );
    const existingCodes = new Set(
      existingAssets.map((item) => this.normalizeHeader(item.internalCode)),
    );
    const seenCodes = new Set<string>();
    const imported: AssetWithRelations[] = [];
    const errors: AssetImportError[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      const row = rows[index];
      const rowErrors: string[] = [];

      const internalCode = this.trimToUndefined(
        resolved.internalCode ? row[resolved.internalCode] : undefined,
      );
      const typeInput = resolved.type ? row[resolved.type] : undefined;
      const brand = this.trimToUndefined(
        resolved.brand ? row[resolved.brand] : undefined,
      );
      const model = this.trimToUndefined(
        resolved.model ? row[resolved.model] : undefined,
      );
      const serialNumber = this.trimToNull(
        resolved.serialNumber ? row[resolved.serialNumber] : undefined,
      );
      const notes = this.trimToNull(resolved.notes ? row[resolved.notes] : undefined);
      const categoryName = this.trimToUndefined(
        resolved.categoryName ? row[resolved.categoryName] : undefined,
      );
      const locationName = this.trimToUndefined(
        resolved.locationName ? row[resolved.locationName] : undefined,
      );
      const status = resolved.status
        ? this.parseAssetStatus(row[resolved.status]) ?? AssetStatus.ESTOQUE
        : AssetStatus.ESTOQUE;
      const valueCents = resolved.valueCents
        ? this.parseMoneyToCents(row[resolved.valueCents])
        : null;
      const type = this.parseAssetType(typeInput);
      const normalizedCode = this.normalizeHeader(internalCode ?? '');

      if (!internalCode) rowErrors.push('Codigo e obrigatorio');
      if (!type) rowErrors.push('Tipo invalido');
      if (!brand) rowErrors.push('Marca e obrigatoria');
      if (!model) rowErrors.push('Modelo e obrigatorio');

      if (internalCode) {
        if (existingCodes.has(normalizedCode)) {
          rowErrors.push('Codigo duplicado no banco');
        }

        if (seenCodes.has(normalizedCode)) {
          rowErrors.push('Codigo duplicado na planilha');
        }
      }

      if (type && this.typedAssets.has(type) && valueCents == null) {
        rowErrors.push('Valor e obrigatorio para Desktop, Notebook e Monitor');
      }

      if (resolved.status && !status) {
        rowErrors.push('Status invalido');
      }

      const categoryId = categoryName
        ? this.resolveEntityIdByName(categoryName, categoryLookup)
        : null;
      if (categoryName && !categoryId) {
        rowErrors.push('Categoria nao encontrada');
      }

      const locationId = locationName
        ? this.resolveEntityIdByName(locationName, locationLookup)
        : null;
      if (locationName && !locationId) {
        rowErrors.push('Localizacao nao encontrada');
      }

      if (rowErrors.length > 0) {
        errors.push({
          rowNumber,
          code: internalCode ?? null,
          message: rowErrors.join('; '),
        });
        continue;
      }

      try {
        const asset = await this.prisma.$transaction(async (tx) => {
          const created = await tx.asset.create({
            data: {
              internalCode: internalCode as string,
              type: type as AssetType,
              brand: brand as string,
              model: model ?? null,
              serialNumber,
              valueCents: valueCents ?? null,
              notes,
              categoryId,
              locationId,
              status,
            },
            include: {
              category: true,
              location: true,
            },
          });

          await tx.auditLog.create({
            data: {
              action: 'ASSET_IMPORTED',
              entityType: 'Asset',
              entityId: created.id,
              description: `Asset ${created.internalCode} importado em lote`,
              userId: userId ?? null,
              },
            });

          return created as AssetWithRelations;
        });

        imported.push(asset);
        existingCodes.add(normalizedCode);
        seenCodes.add(normalizedCode);
      } catch (err: unknown) {
        errors.push({
          rowNumber,
          code: internalCode ?? null,
          message:
            err instanceof Error ? err.message : 'Nao foi possivel importar a linha',
        });
      }
    }

    return {
      totalRows: rows.length,
      importedCount: imported.length,
      ignoredCount: errors.length,
      errors,
      imported,
    };
  }

  private ensureValueForTypedAsset(type: AssetType, valueCents?: number | null) {
    if (this.typedAssets.has(type) && valueCents == null) {
      throw new BadRequestException(
        'valueCents e obrigatorio para DESKTOP, NOTEBOOK e MONITOR',
      );
    }
  }

  private async generateInternalCode(): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const counter = await tx.counter.update({
        where: { key: 'asset' },
        data: { nextNumber: { increment: 1 } },
      });

      const current = counter.nextNumber - 1;
      return `TI-${String(current).padStart(6, '0')}`;
    });
  }

  async create(dto: CreateAssetDto, userId?: string | null) {
    this.ensureValueForTypedAsset(dto.type, dto.valueCents);
    const normalizedBrand = this.trimToUndefined(dto.brand);

    if (!normalizedBrand) {
      throw new BadRequestException('brand e obrigatorio');
    }

    const internalCode = await this.generateInternalCode();

    const asset = await this.prisma.asset.create({
      data: {
        internalCode,
        type: dto.type,
        brand: normalizedBrand,
        model: this.trimToNull(dto.model),
        serialNumber: this.trimToNull(dto.serialNumber),
        valueCents: dto.valueCents,
        status: dto.status ?? AssetStatus.ESTOQUE,
        notes: this.trimToNull(dto.notes),
        categoryId: this.trimToNullishId(dto.categoryId),
        locationId: this.trimToNullishId(dto.locationId),
      },
    });

    await this.auditLogs?.create({
      action: 'ASSET_CREATED',
      entityType: 'Asset',
      entityId: asset.id,
      description: `${this.describeAsset(asset)} criado`,
      userId,
    });

    return asset;
  }

  async findAll(filters: FindAssetsQueryDto) {
    const { type, status, brand, q } = filters;
    const normalizedBrand = this.trimToUndefined(brand);
    const normalizedQuery = this.trimToUndefined(q);

    return this.prisma.asset.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(normalizedBrand
          ? { brand: { contains: normalizedBrand, mode: 'insensitive' } }
          : {}),
        ...(normalizedQuery
          ? {
              OR: [
                {
                  internalCode: {
                    contains: normalizedQuery,
                    mode: 'insensitive',
                  },
                },
                {
                  brand: {
                    contains: normalizedQuery,
                    mode: 'insensitive',
                  },
                },
                {
                  model: {
                    contains: normalizedQuery,
                    mode: 'insensitive',
                  },
                },
                {
                  serialNumber: {
                    contains: normalizedQuery,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        category: true,
        location: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        category: true,
        location: true,
      },
    });
    if (!asset) throw new NotFoundException('Ativo nao encontrado');

    return asset;
  }

  async findDetails(id: string) {
    const asset = await this.findOne(id);
    const assignments = await this.prisma.assignment.findMany({
      where: { assetId: id },
      include: {
        employee: true,
      },
      orderBy: {
        assignedAt: 'desc',
      },
    });

    const assignmentIds = assignments.map((assignment) => assignment.id);
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          {
            entityType: 'Asset',
            entityId: id,
          },
          ...(assignmentIds.length > 0
            ? [
                {
                  entityType: 'Assignment',
                  entityId: {
                    in: assignmentIds,
                  },
                },
              ]
            : []),
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return {
      asset,
      currentAssignment:
        assignments.find((assignment) => assignment.returnedAt === null) ?? null,
      history: assignments,
      auditLogs,
    };
  }

  async update(id: string, dto: UpdateAssetDto, userId?: string | null) {
    const exists = await this.prisma.asset.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Ativo nao encontrado');

    const nextType = dto.type ?? exists.type;
    const nextValueCents =
      dto.valueCents !== undefined ? dto.valueCents : exists.valueCents;

    this.ensureValueForTypedAsset(nextType, nextValueCents);

    const asset = await this.prisma.asset.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.valueCents !== undefined && { valueCents: dto.valueCents }),
        ...(dto.brand !== undefined && {
          brand: this.trimToUndefined(dto.brand) ?? exists.brand,
        }),
        ...(dto.model !== undefined && {
          model: this.trimToNull(dto.model),
        }),
        ...(dto.serialNumber !== undefined && {
          serialNumber: this.trimToNull(dto.serialNumber),
        }),
        ...(dto.notes !== undefined && {
          notes: this.trimToNull(dto.notes),
        }),
        ...(dto.categoryId !== undefined && {
          categoryId: this.trimToNullishId(dto.categoryId),
        }),
        ...(dto.locationId !== undefined && {
          locationId: this.trimToNullishId(dto.locationId),
        }),
      },
      include: {
        category: true,
        location: true,
      },
    });

    await this.auditLogs?.create({
      action: 'ASSET_UPDATED',
      entityType: 'Asset',
      entityId: asset.id,
      description: `${this.describeAsset(asset)} atualizado`,
      userId,
    });

    return asset;
  }

  async remove(id: string) {
    const exists = await this.prisma.asset.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Ativo nao encontrado');

    return this.prisma.asset.delete({
      where: { id },
    });
  }
}
