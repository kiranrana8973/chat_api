import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { AppleAuthDto } from './dto/apple-auth.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { UserDocument } from '../users/schemas/user.schema';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    res.status(HttpStatus.CREATED);
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  async google(
    @Body() dto: GoogleAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.googleAuth(dto);
    res.status(result.isNewUser ? HttpStatus.CREATED : HttpStatus.OK);
    return result;
  }

  @Post('apple')
  async apple(
    @Body() dto: AppleAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.appleAuth(dto);
    res.status(result.isNewUser ? HttpStatus.CREATED : HttpStatus.OK);
    return result;
  }

  @Post('complete-profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async completeProfile(
    @CurrentUser() user: UserDocument,
    @Body() dto: CompleteProfileDto,
  ) {
    return this.authService.completeProfile(user._id.toString(), dto);
  }
}
