import {
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
        'Nao e possivel remover funcionario com atribuicoes relacionadas',
      );
    }

    throw error;
  }

  findAll() {
    return this.prisma.employee.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateEmployeeDto, userId?: string | null) {
    try {
      const employee = await this.prisma.employee.create({
        data: {
          name: dto.name.trim(),
          email: dto.email.trim().toLowerCase(),
          department: this.trimToNull(dto.department),
          position: this.trimToNull(dto.position),
        },
      });

      await this.auditLogs?.create({
        action: 'EMPLOYEE_CREATED',
        entityType: 'Employee',
        entityId: employee.id,
        description: `Funcionario ${employee.name} criado`,
        userId,
      });

      return employee;
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    const exists = await this.prisma.employee.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Funcionario nao encontrado');

    try {
      return await this.prisma.employee.update({
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
        },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async remove(id: string) {
    const exists = await this.prisma.employee.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Funcionario nao encontrado');

    try {
      return await this.prisma.employee.delete({ where: { id } });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }
}
