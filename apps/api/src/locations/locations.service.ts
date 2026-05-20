import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  private trimToNull(value?: string | null) {
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private handlePrismaError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Ja existe um local com esse nome');
    }

    throw error;
  }

  private handleDeleteDependencies() {
    throw new ConflictException(
      'Não é possível excluir. Existem ativos ou funcionários vinculados.',
    );
  }

  findAll() {
    return this.prisma.location.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateLocationDto) {
    try {
      return await this.prisma.location.create({
        data: {
          name: dto.name.trim(),
          description: this.trimToNull(dto.description),
        },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async update(id: string, dto: UpdateLocationDto) {
    const exists = await this.prisma.location.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Local nao encontrado');

    try {
      return await this.prisma.location.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.description !== undefined && {
            description: this.trimToNull(dto.description),
          }),
        },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async remove(id: string) {
    const exists = await this.prisma.location.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Local nao encontrado');

    const [linkedAssets, linkedEmployees] = await Promise.all([
      this.prisma.asset.count({ where: { locationId: id } }),
      this.prisma.employee.count({ where: { locationId: id } }),
    ]);

    if (linkedAssets > 0 || linkedEmployees > 0) {
      this.handleDeleteDependencies();
    }

    return this.prisma.location.delete({ where: { id } });
  }
}
