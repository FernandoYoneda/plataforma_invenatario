import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
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

  async create(dto: CreateAssignmentDto, userId?: string | null) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: dto.assetId },
    });
    if (!asset) throw new NotFoundException('Ativo nao encontrado');

    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });
    if (!employee) throw new NotFoundException('Funcionario nao encontrado');

    const activeAssignment = await this.prisma.assignment.findFirst({
      where: {
        assetId: dto.assetId,
        returnedAt: null,
      },
    });

    if (activeAssignment) {
      throw new BadRequestException('Ativo ja possui atribuicao ativa');
    }

    const assignment = await this.prisma.assignment.create({
      data: {
        assetId: dto.assetId,
        employeeId: dto.employeeId,
        notes: this.trimToNull(dto.notes),
      },
      include: {
        asset: true,
        employee: true,
      },
    });

    await this.auditLogs?.create({
      action: 'ASSIGNMENT_CREATED',
      entityType: 'Assignment',
      entityId: assignment.id,
      description: `Asset ${assignment.asset.internalCode} atribuido para ${assignment.employee?.name ?? assignment.employeeId ?? 'Funcionario removido'}`,
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
    });

    if (!assignment) {
      throw new NotFoundException('Atribuicao nao encontrada');
    }

    if (assignment.returnedAt) {
      throw new BadRequestException('Atribuicao ja foi encerrada');
    }

    const returnedAssignment = await this.prisma.assignment.update({
      where: { id },
      data: {
        returnedAt: new Date(),
        ...(dto.notes !== undefined && { notes: this.trimToNull(dto.notes) }),
      },
      include: {
        asset: true,
        employee: true,
      },
    });

    await this.auditLogs?.create({
      action: 'ASSIGNMENT_RETURNED',
      entityType: 'Assignment',
      entityId: returnedAssignment.id,
      description: `Asset ${returnedAssignment.asset.internalCode} devolvido por ${returnedAssignment.employee?.name ?? returnedAssignment.employeeId ?? 'Funcionario removido'}`,
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
        asset: true,
        employee: true,
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
        employee: true,
      },
      orderBy: {
        assignedAt: 'desc',
      },
    });
  }
}
