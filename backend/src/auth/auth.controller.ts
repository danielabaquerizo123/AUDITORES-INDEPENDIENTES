import { Body, Controller, Get, Patch, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { AuthService } from './auth.service'; import { JwtAuthGuard } from './guards/jwt-auth.guard';
class LoginDto { @IsEmail() email!: string; @IsString() password!: string; }
class ChangePasswordDto { @IsString() @IsNotEmpty() currentPassword!: string; @IsString() @IsNotEmpty() newPassword!: string; @IsString() @IsNotEmpty() confirmPassword!: string; }
@Controller('auth') export class AuthController {
  constructor(private readonly auth: AuthService) {}
  private cookieOptions() {
    const secure = process.env.NODE_ENV === 'production';
    return { httpOnly: true, secure, sameSite: secure ? 'none' as const : 'lax' as const, path: '/api/auth' };
  }
  @Post('login') async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(dto.email, dto.password);
    response.cookie('refreshToken', result.refreshToken, { ...this.cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
    return { accessToken: result.accessToken, user: result.user };
  }
  @Post('refresh') async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const cookieHeader = request.headers.cookie ?? '';
    const raw = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith('refreshToken='))?.slice('refreshToken='.length);
    let token = '';
    if (raw) {
      try { token = decodeURIComponent(raw); } catch { token = ''; }
    }
    try { return await this.auth.refresh(token); }
    catch (error) {
      if (error instanceof UnauthorizedException) response.clearCookie('refreshToken', this.cookieOptions());
      throw error;
    }
  }
  @Post('logout') logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('refreshToken', this.cookieOptions());
    return { success: true };
  }
  @UseGuards(JwtAuthGuard) @Get('me') me(@Req() request: { user: { id: string } }) { return this.auth.me(request.user.id); }
  @UseGuards(JwtAuthGuard) @Patch('change-password') changePassword(@Req() request: { user: { id: string } }, @Body() dto: ChangePasswordDto) { return this.auth.changePassword(request.user.id, dto); }
}
