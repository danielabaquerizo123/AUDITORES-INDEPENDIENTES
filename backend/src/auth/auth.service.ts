import { Injectable, UnauthorizedException } from '@nestjs/common';
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
    const accessToken = await this.jwt.signAsync({ sub: user.id, organizationId: user.organizationId, permissions }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' });
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { accessToken, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, organization: { id: user.organization.id, name: user.organization.name }, permissions } };
  }
  async me(userId: string) { const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { organization: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } }); if (!user) throw new UnauthorizedException(); return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, organization: { id: user.organization.id, name: user.organization.name }, roles: user.roles.map((item) => item.role.name), permissions: user.roles.flatMap((item) => item.role.permissions.map((permission) => permission.permission.key)) }; }
}
