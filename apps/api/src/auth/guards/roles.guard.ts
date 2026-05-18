import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { normalizeRole } from '../roles';

type RequestUser = {
  role?: Role | string;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const userRole = normalizeRole(request.user?.role);
    const normalizedRequiredRoles = requiredRoles
      .map((role) => normalizeRole(role))
      .filter(Boolean) as Role[];

    if (!userRole || !normalizedRequiredRoles.includes(userRole)) {
      throw new ForbiddenException('Acesso restrito');
    }

    return true;
  }
}
