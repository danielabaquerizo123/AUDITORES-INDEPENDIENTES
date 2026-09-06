import { grantAdminPermissions } from '../src/auth/admin-permissions';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const required = ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'ADMIN_FIRST_NAME', 'ADMIN_LAST_NAME', 'ADMIN_ORGANIZATION_ID'] as const;
export async function createAdmin(prisma: PrismaClient, input: Record<string, string | undefined>) { for (const key of required) if (!input[key]) throw new Error(`${key} is required`); const organizationId=input.ADMIN_ORGANIZATION_ID!; const email=input.ADMIN_EMAIL!.toLowerCase(); const [organization,role,existing]=await Promise.all([prisma.organization.findUnique({where:{id:organizationId}}),prisma.role.findUnique({where:{organizationId_name:{organizationId,name:'ADMIN'}}}),prisma.user.findUnique({where:{organizationId_email:{organizationId,email}}})]); if(!organization)throw new Error('Organization not found');if(!role)throw new Error('ADMIN role not found');if(existing)throw new Error('User already exists');const passwordHash=await argon2.hash(input.ADMIN_PASSWORD!,{type:argon2.argon2id});return prisma.$transaction(async tx=>{await grantAdminPermissions(tx,role.id);const user=await tx.user.create({data:{organizationId,email,passwordHash,firstName:input.ADMIN_FIRST_NAME!,lastName:input.ADMIN_LAST_NAME!}});await tx.userRole.create({data:{userId:user.id,roleId:role.id}});return user}); }
async function main() { const prisma = new PrismaClient(); try { await createAdmin(prisma, process.env); console.log('Admin user created successfully'); } finally { await prisma.$disconnect(); } }
if (require.main === module) void main();

