import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export type AuthenticatedUser = { id: string; organizationId: string; permissions: string[]; roles: string[] };
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => context.switchToHttp().getRequest().user as AuthenticatedUser);
