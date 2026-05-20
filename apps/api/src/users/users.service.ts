import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

type SafeUser = Prisma.UserGetPayload<{
  select: typeof userSelect;
}>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private async getActiveAdminCount(tx = this.prisma) {
    return tx.user.count({
      where: { role: Role.ADMIN, isActive: true },
    });
  }

  private async ensureLastAdminCanStayActive(
    userId: string,
    nextRole?: Role,
    nextActive?: boolean,
  ) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true },
    });

    if (!current) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    const currentIsAdmin = current.role === Role.ADMIN && current.isActive;
    const nextIsAdmin = (nextRole ?? current.role) === Role.ADMIN && (nextActive ?? current.isActive);

    if (currentIsAdmin && !nextIsAdmin) {
      const activeAdmins = await this.getActiveAdminCount();

      if (activeAdmins <= 1) {
        throw new BadRequestException(
          'Nao e possivel remover o ultimo administrador ativo.',
        );
      }
    }
  }

  private safeUser(user: SafeUser) {
    return user;
  }

  async findAll(status?: string) {
    const where =
      status === 'active'
        ? { isActive: true }
        : status === 'inactive'
          ? { isActive: false }
          : {};

    const users = await this.prisma.user.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      select: userSelect,
    });

    return users.map((user) => this.safeUser(user));
  }

  async create(dto: CreateUserDto, actorId?: string | null) {
    try {
      const passwordHash = await bcrypt.hash(dto.password, 10);

      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: dto.name.trim(),
            email: dto.email.trim().toLowerCase(),
            passwordHash,
            role: dto.role,
            isActive: true,
          },
          select: userSelect,
        });

        await tx.auditLog.create({
          data: {
            action: 'USER_CREATED',
            entityType: 'User',
            entityId: created.id,
            description: `Usuario ${created.name} criado com perfil ${created.role}.`,
            userId: actorId ?? null,
          },
        });

        return created;
      });

      return this.safeUser(user);
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new BadRequestException(
          'Ja existe um usuario cadastrado com esse email.',
        );
      }

      throw error;
    }
  }

  async update(id: string, dto: UpdateUserDto, actorId?: string | null) {
    await this.ensureLastAdminCanStayActive(id, dto.role);

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const nextUser = await tx.user.update({
          where: { id },
          data: {
            ...(dto.name ? { name: dto.name.trim() } : {}),
            ...(dto.role ? { role: dto.role } : {}),
          },
          select: userSelect,
        });

        await tx.auditLog.create({
          data: {
            action: 'USER_UPDATED',
            entityType: 'User',
            entityId: nextUser.id,
            description: `Usuario ${nextUser.name} atualizado.`,
            userId: actorId ?? null,
          },
        });

        return nextUser;
      });

      return this.safeUser(updated);
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new BadRequestException(
          'Ja existe um usuario cadastrado com esse email.',
        );
      }

      throw error;
    }
  }

  async inactivate(id: string, actorId?: string | null) {
    await this.ensureLastAdminCanStayActive(id, undefined, false);

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    if (!user.isActive) {
      return this.safeUser(user);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id },
        data: { isActive: false },
        select: userSelect,
      });

      await tx.auditLog.create({
        data: {
          action: 'USER_INACTIVATED',
          entityType: 'User',
          entityId: nextUser.id,
          description: `Usuario ${nextUser.name} inativado.`,
          userId: actorId ?? null,
        },
      });

      return nextUser;
    });

    return this.safeUser(updated);
  }

  async activate(id: string, actorId?: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    if (user.isActive) {
      return this.safeUser(user);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id },
        data: { isActive: true },
        select: userSelect,
      });

      await tx.auditLog.create({
        data: {
          action: 'USER_ACTIVATED',
          entityType: 'User',
          entityId: nextUser.id,
          description: `Usuario ${nextUser.name} reativado.`,
          userId: actorId ?? null,
        },
      });

      return nextUser;
    });

    return this.safeUser(updated);
  }

  async resetPassword(id: string, dto: ResetPasswordDto, actorId?: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id },
        data: { passwordHash },
        select: userSelect,
      });

      await tx.auditLog.create({
        data: {
          action: 'USER_PASSWORD_RESET',
          entityType: 'User',
          entityId: nextUser.id,
          description: `Senha do usuario ${nextUser.name} redefinida.`,
          userId: actorId ?? null,
        },
      });

      return nextUser;
    });

    return this.safeUser(updated);
  }
}
