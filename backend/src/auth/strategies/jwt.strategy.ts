import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false, secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET') });
  }
  async validate(payload: { sub: string; organizationId: string }) {
    const user = await this.prisma.user.findFirst({ where: { id: payload.sub, organizationId: payload.organizationId, status: 'ACTIVE', deletedAt: null }, include: { organization: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } });
    if (!user) throw new UnauthorizedException();
    return { id: user.id, organizationId: user.organizationId, email: user.email, firstName: user.firstName, lastName: user.lastName, organization: { id: user.organization.id, name: user.organization.name }, roles: user.roles.map((item) => item.role.name), permissions: user.roles.flatMap((item) => item.role.permissions.map((permission) => permission.permission.key)) };
  }
}
