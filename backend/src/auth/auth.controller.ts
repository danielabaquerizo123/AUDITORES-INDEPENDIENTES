import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { AuthService } from './auth.service'; import { JwtAuthGuard } from './guards/jwt-auth.guard';
class LoginDto { @IsEmail() email!: string; @IsString() password!: string; }
class ChangePasswordDto { @IsString() @IsNotEmpty() currentPassword!: string; @IsString() @IsNotEmpty() newPassword!: string; @IsString() @IsNotEmpty() confirmPassword!: string; }
@Controller('auth') export class AuthController { constructor(private readonly auth: AuthService) {} @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto.email, dto.password); } @Post('logout') logout() { return { success: true }; } @UseGuards(JwtAuthGuard) @Get('me') me(@Req() request: { user: { id: string } }) { return this.auth.me(request.user.id); } @UseGuards(JwtAuthGuard) @Patch('change-password') changePassword(@Req() request: { user: { id: string } }, @Body() dto: ChangePasswordDto) { return this.auth.changePassword(request.user.id, dto); } }
