import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssetType } from '@prisma/client';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

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

  async update(id: string, dto: UpdateAssetDto) {
    const exists = await this.prisma.asset.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Ativo não encontrado');

    return this.prisma.asset.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.valueCents !== undefined && { valueCents: dto.valueCents }),

        ...(dto.brand !== undefined && {
          brand: typeof dto.brand === 'string' ? dto.brand.trim() : '',
        }),

        ...(dto.model !== undefined && {
          model:
            typeof dto.model === 'string' ? dto.model.trim() || null : null,
        }),

        ...(dto.serialNumber !== undefined && {
          serialNumber:
            typeof dto.serialNumber === 'string'
              ? dto.serialNumber.trim() || null
              : null,
        }),

        ...(dto.notes !== undefined && {
          notes:
            typeof dto.notes === 'string' ? dto.notes.trim() || null : null,
        }),
      },
    });
  }

  async remove(id: string) {
    return this.prisma.asset.delete({
      where: { id },
    });
  }

  async create(dto: CreateAssetDto) {
    const needsValue = new Set<AssetType>([
      AssetType.DESKTOP,
      AssetType.NOTEBOOK,
      AssetType.MONITOR,
    ]).has(dto.type);

    if (
      needsValue &&
      (dto.valueCents === undefined || dto.valueCents === null)
    ) {
      throw new Error('valueCents é obrigatório para DESKTOP/NOTEBOOK/MONITOR');
    }

    const internalCode = await this.generateInternalCode();

    return this.prisma.asset.create({
      data: {
        internalCode,
        type: dto.type,
        brand: dto.brand,
        model: dto.model,
        serialNumber: dto.serialNumber,
        valueCents: dto.valueCents,
        status: dto.status,
        notes: dto.notes,
      },
    });
  }

  async findAll(filters: {
    type?: string;
    status?: string;
    brand?: string;
    q?: string;
  }) {
    const { type, status, brand, q } = filters;

    return this.prisma.asset.findMany({
      where: {
        ...(type ? { type: type as any } : {}),
        ...(status ? { status: status as any } : {}),
        ...(brand ? { brand: { contains: brand, mode: 'insensitive' } } : {}),
        ...(q
          ? {
              OR: [
                { internalCode: { contains: q, mode: 'insensitive' } },
                { model: { contains: q, mode: 'insensitive' } },
                { serialNumber: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.asset.findUnique({ where: { id } });
  }
}
