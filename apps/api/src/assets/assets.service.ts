import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssetType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { FindAssetsQueryDto } from './dto/find-assets-query.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

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

  async create(dto: CreateAssetDto) {
    this.ensureValueForTypedAsset(dto.type, dto.valueCents);
    const normalizedBrand = this.trimToUndefined(dto.brand);

    if (!normalizedBrand) {
      throw new BadRequestException('brand e obrigatorio');
    }

    const internalCode = await this.generateInternalCode();

    return this.prisma.asset.create({
      data: {
        internalCode,
        type: dto.type,
        brand: normalizedBrand,
        model: this.trimToNull(dto.model),
        serialNumber: this.trimToNull(dto.serialNumber),
        valueCents: dto.valueCents,
        status: dto.status,
        notes: this.trimToNull(dto.notes),
      },
    });
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

  async update(id: string, dto: UpdateAssetDto) {
    const exists = await this.prisma.asset.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Ativo nao encontrado');

    const nextType = dto.type ?? exists.type;
    const nextValueCents =
      dto.valueCents !== undefined ? dto.valueCents : exists.valueCents;

    this.ensureValueForTypedAsset(nextType, nextValueCents);

    return this.prisma.asset.update({
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
      },
    });
  }

  async remove(id: string) {
    const exists = await this.prisma.asset.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Ativo nao encontrado');

    return this.prisma.asset.delete({
      where: { id },
    });
  }
}
