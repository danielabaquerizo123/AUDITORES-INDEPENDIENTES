import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}
  async login(email: string, password: string) {
    const user = await this.prisma.user.findFirst({ where: { email, status: 'ACTIVE', deletedAt: null }, include: { organization: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } });
    if (!user || !(await argon2.verify(user.passwordHash, password))) throw new UnauthorizedException('Invalid email or password');
    const permissions = user.roles.flatMap((entry) => entry.role.permissions.map((item) => item.permission.key));
    const accessToken = await this.accessToken(user.id, user.organizationId, permissions);
    const refreshToken = await this.jwt.signAsync({ sub: user.id, organizationId: user.organizationId, tokenUse: 'refresh' }, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '7d' });
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, organization: { id: user.organization.id, name: user.organization.name }, permissions } };
  }
  private accessToken(userId: string, organizationId: string, permissions: string[]) {
    return this.jwt.signAsync({ sub: userId, organizationId, permissions }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' });
  }
  async refresh(refreshToken: string) {
    let payload: { sub: string; organizationId: string; tokenUse?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException('La sesión renovable no es válida.');
    }
    if (payload.tokenUse !== 'refresh' || !payload.sub || !payload.organizationId) throw new UnauthorizedException('La sesión renovable no es válida.');
    const user = await this.prisma.user.findFirst({ where: { id: payload.sub, organizationId: payload.organizationId, status: 'ACTIVE', deletedAt: null }, include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } });
    if (!user) throw new UnauthorizedException('La sesión renovable no es válida.');
    const permissions = user.roles.flatMap((entry) => entry.role.permissions.map((item) => item.permission.key));
    return { accessToken: await this.accessToken(user.id, user.organizationId, permissions) };
  }
  async changePassword(userId: string, dto: { currentPassword: string; newPassword: string; confirmPassword: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      throw new BadRequestException('La contraseña actual es incorrecta.');
    }
    if (dto.newPassword !== dto.confirmPassword) throw new BadRequestException('La confirmación de contraseña no coincide.');
    if (dto.newPassword === dto.currentPassword) throw new BadRequestException('La nueva contraseña debe ser distinta de la actual.');
    if (dto.newPassword.length < 8 || !/[A-Z]/.test(dto.newPassword) || !/[a-z]/.test(dto.newPassword) || !/\d/.test(dto.newPassword) || !/[^A-Za-z0-9]/.test(dto.newPassword)) {
      throw new BadRequestException('La nueva contraseña no cumple los requisitos de seguridad.');
    }
    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    return { success: true };
  }
  async me(userId: string) { const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { organization: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } }); if (!user) throw new UnauthorizedException(); return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, organization: { id: user.organization.id, name: user.organization.name }, roles: user.roles.map((item) => item.role.name), permissions: user.roles.flatMap((item) => item.role.permissions.map((permission) => permission.permission.key)) }; }
}
