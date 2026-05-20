import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AssetStatus } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { ReturnAssignmentDto } from './dto/return-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditLogs?: AuditLogsService,
  ) {}

  private trimToNull(value?: string | null) {
    if (typeof value !== 'string') return null;

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

  private describeLocation(location?: { name: string } | null) {
    return location?.name
      ? `na localizacao ${location.name}`
      : 'sem localizacao vinculada';
  }

  async create(dto: CreateAssignmentDto, userId?: string | null) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: dto.assetId },
      include: {
        location: true,
      },
    });
    if (!asset) throw new NotFoundException('Ativo nao encontrado');

    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      include: {
        location: true,
      },
    });
    if (!employee) throw new NotFoundException('Funcionario nao encontrado');

    if (!employee.locationId) {
      throw new BadRequestException(
        'Funcionario precisa de localizacao para receber ativos.',
      );
    }

    const activeAssignment = await this.prisma.assignment.findFirst({
      where: {
        assetId: dto.assetId,
        returnedAt: null,
      },
    });

    if (asset.status !== AssetStatus.ESTOQUE) {
      throw new BadRequestException('Ativo indisponivel para atribuicao');
    }

    if (activeAssignment) {
      throw new BadRequestException('Ativo ja possui atribuicao ativa');
    }

    const assignmentId = await this.prisma.$transaction(async (tx) => {
      const createdAssignment = await tx.assignment.create({
        data: {
          assetId: dto.assetId,
          employeeId: dto.employeeId,
          notes: this.trimToNull(dto.notes),
        },
      });

      await tx.asset.update({
        where: { id: dto.assetId },
        data: {
          status: AssetStatus.EM_USO,
          locationId: employee.locationId ?? null,
        },
      });

      return createdAssignment.id;
    });

    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        asset: {
          include: {
            location: true,
            category: true,
          },
        },
        employee: {
          include: {
            location: true,
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Atribuicao nao encontrada');
    }

    await this.auditLogs?.create({
      action: 'ASSIGNMENT_CREATED',
      entityType: 'Assignment',
      entityId: assignment.id,
      description: `${this.describeAsset(assignment.asset)} atribuÃ­do para ${assignment.employee?.name ?? assignment.employeeId ?? 'funcionÃ¡rio removido'} ${this.describeLocation(assignment.employee?.location)}`,
      userId,
    });

    return assignment;
  }

  async returnAssignment(
    id: string,
    dto: ReturnAssignmentDto,
    userId?: string | null,
  ) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      include: {
        asset: {
          include: {
            location: true,
            category: true,
          },
        },
        employee: {
          include: {
            location: true,
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Atribuicao nao encontrada');
    }

    if (assignment.returnedAt) {
      throw new BadRequestException('Atribuicao ja foi encerrada');
    }

    const returnedAssignmentId = await this.prisma.$transaction(async (tx) => {
      const updatedAssignment = await tx.assignment.update({
        where: { id },
        data: {
          returnedAt: new Date(),
          ...(dto.notes !== undefined && { notes: this.trimToNull(dto.notes) }),
        },
      });

      await tx.asset.update({
        where: { id: updatedAssignment.assetId },
        data: {
          status: AssetStatus.ESTOQUE,
          locationId: null,
        },
      });

      return updatedAssignment.id;
    });

    const returnedAssignment = await this.prisma.assignment.findUnique({
      where: { id: returnedAssignmentId },
      include: {
        asset: {
          include: {
            location: true,
            category: true,
          },
        },
        employee: {
          include: {
            location: true,
          },
        },
      },
    });

    if (!returnedAssignment) {
      throw new NotFoundException('Atribuicao nao encontrada');
    }

    await this.auditLogs?.create({
      action: 'ASSIGNMENT_RETURNED',
      entityType: 'Assignment',
      entityId: returnedAssignment.id,
      description: `${this.describeAsset(returnedAssignment.asset)} devolvido por ${returnedAssignment.employee?.name ?? returnedAssignment.employeeId ?? 'funcionÃ¡rio removido'} ${this.describeLocation(returnedAssignment.asset?.location)}`,
      userId,
    });

    return returnedAssignment;
  }

  findActive() {
    return this.prisma.assignment.findMany({
      where: {
        returnedAt: null,
      },
      include: {
        asset: {
          include: {
            location: true,
            category: true,
          },
        },
        employee: {
          include: {
            location: true,
          },
        },
      },
      orderBy: {
        assignedAt: 'desc',
      },
    });
  }

  async findAssetHistory(assetId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException('Ativo nao encontrado');
    }

    return this.prisma.assignment.findMany({
      where: { assetId },
      include: {
        employee: {
          include: {
            location: true,
          },
        },
      },
      orderBy: {
        assignedAt: 'desc',
      },
    });
  }
}
