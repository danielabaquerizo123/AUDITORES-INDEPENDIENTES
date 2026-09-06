import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsString } from 'class-validator';
import { AuthService } from './auth.service'; import { JwtAuthGuard } from './guards/jwt-auth.guard';
class LoginDto { @IsEmail() email!: string; @IsString() password!: string; }
@Controller('auth') export class AuthController { constructor(private readonly auth: AuthService) {} @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto.email, dto.password); } @Post('logout') logout() { return { success: true }; } @UseGuards(JwtAuthGuard) @Get('me') me(@Req() request: { user: { id: string } }) { return this.auth.me(request.user.id); } }
