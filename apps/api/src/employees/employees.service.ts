import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditLogs?: AuditLogsService,
  ) {}

  private trimToNull(value?: string | null) {
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private trimToNullId(value?: string | null) {
    return this.trimToNull(value);
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

  private handlePrismaError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Ja existe um funcionario com esse email');
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new ConflictException(
        'Nao foi possivel salvar o funcionario. Verifique a localizacao informada.',
      );
    }

    throw error;
  }

  findAll(status?: string) {
    const normalizedStatus = typeof status === 'string' ? status.trim().toLowerCase() : '';
    const where =
      normalizedStatus === 'all'
        ? {}
        : normalizedStatus === 'inactive'
          ? { isActive: false }
          : { isActive: true };

    return this.prisma.employee.findMany({
      where,
      include: {
        location: true,
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async findAssignments(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      throw new NotFoundException('Funcionario nao encontrado');
    }

    return this.prisma.assignment.findMany({
      where: { employeeId: id },
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

  async create(dto: CreateEmployeeDto, userId?: string | null) {
    const locationId = this.trimToNullId(dto.locationId);
    if (!locationId) {
      throw new BadRequestException('Funcionario precisa de localizacao');
    }

    try {
      const employee = await this.prisma.employee.create({
        data: {
          name: dto.name.trim(),
          email: dto.email.trim().toLowerCase(),
          department: this.trimToNull(dto.department),
          position: this.trimToNull(dto.position),
          locationId,
          isActive: true,
        },
        include: {
          location: true,
        },
      });

      await this.auditLogs?.create({
        action: 'EMPLOYEE_CREATED',
        entityType: 'Employee',
        entityId: employee.id,
        description: `Funcionário ${employee.name} criado`,
        userId,
      });

      return employee;
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async update(id: string, dto: UpdateEmployeeDto, userId?: string | null) {
    const exists = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        location: true,
      },
    });
    if (!exists) throw new NotFoundException('Funcionario nao encontrado');

    const nextLocationId = this.trimToNullId(dto.locationId);
    if (!nextLocationId) {
      throw new BadRequestException('Funcionario precisa de localizacao');
    }

    const activeAssignments = await this.prisma.assignment.findMany({
      where: {
        employeeId: id,
        returnedAt: null,
      },
      include: {
        asset: {
          include: {
            location: true,
          },
        },
      },
    });
    const locationChanged = exists.locationId !== nextLocationId;

    try {
      const updatedEmployee = await this.prisma.$transaction(async (tx) => {
        const employee = await tx.employee.update({
          where: { id },
          data: {
            ...(dto.name !== undefined && { name: dto.name.trim() }),
            ...(dto.email !== undefined && {
              email: dto.email.trim().toLowerCase(),
            }),
            ...(dto.department !== undefined && {
              department: this.trimToNull(dto.department),
            }),
            ...(dto.position !== undefined && {
              position: this.trimToNull(dto.position),
            }),
            locationId: nextLocationId,
          },
          include: {
            location: true,
          },
        });

        if (locationChanged && activeAssignments.length > 0) {
          await tx.asset.updateMany({
            where: {
              id: {
                in: activeAssignments.map((assignment) => assignment.assetId),
              },
            },
            data: {
              locationId: nextLocationId,
            },
          });
        }

        return employee;
      });

      if (locationChanged && activeAssignments.length > 0) {
        const locationName = updatedEmployee.location?.name ?? 'localizacao informada';

        await Promise.all(
          activeAssignments.map((assignment) =>
            this.auditLogs?.create({
              action: 'ASSET_LOCATION_SYNCED',
              entityType: 'Asset',
              entityId: assignment.assetId,
              description: `${this.describeAsset(assignment.asset)} atualizado para ${locationName} após atualização da localização do funcionario ${updatedEmployee.name}`,
              userId,
            }),
          ),
        );

        await this.auditLogs?.create({
          action: 'EMPLOYEE_LOCATION_UPDATED',
          entityType: 'Employee',
          entityId: updatedEmployee.id,
          description: `Localizacao do funcionario ${updatedEmployee.name} atualizada para ${locationName}. ${activeAssignments.length} ativo(s) sincronizado(s).`,
          userId,
        });
      }

      return updatedEmployee;
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async inactivate(id: string, userId?: string | null) {
    const exists = await this.prisma.employee.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Funcionario nao encontrado');

    const activeAssignment = await this.prisma.assignment.findFirst({
      where: {
        employeeId: id,
        returnedAt: null,
      },
    });

    if (activeAssignment) {
      throw new BadRequestException(
        'Funcionário possui ativos atribuídos. Devolva os ativos antes de inativar.',
      );
    }

    if (!exists.isActive) {
      return exists;
    }

    try {
      const employee = await this.prisma.employee.update({
        where: { id },
        data: { isActive: false },
      });

      await this.auditLogs?.create({
        action: 'EMPLOYEE_INACTIVATED',
        entityType: 'Employee',
        entityId: employee.id,
        description: `Funcionário ${employee.name} inativado`,
        userId,
      });

      return employee;
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async activate(id: string, userId?: string | null) {
    const exists = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        location: true,
      },
    });
    if (!exists) throw new NotFoundException('Funcionario nao encontrado');

    if (exists.isActive) {
      return exists;
    }

    try {
      const employee = await this.prisma.employee.update({
        where: { id },
        data: { isActive: true },
        include: {
          location: true,
        },
      });

      await this.auditLogs?.create({
        action: 'EMPLOYEE_ACTIVATED',
        entityType: 'Employee',
        entityId: employee.id,
        description: `Funcionário ${employee.name} reativado`,
        userId,
      });

      return employee;
    } catch (error) {
      this.handlePrismaError(error);
    }
  }
}
