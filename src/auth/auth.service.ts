import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  HttpException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { OAuthService } from './oauth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { AppleAuthDto } from './dto/apple-auth.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private oauthService: OAuthService,
  ) {}

  private generateToken(userId: string): string {
    return this.jwtService.sign({ userId });
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.userModel.findOne({ email: dto.email });
    if (existingUser) {
      throw new BadRequestException('Email already in use.');
    }

    const user = new this.userModel({
      ...dto,
      authProvider: 'local',
      isProfileComplete: true,
    });
    await user.save();

    const token = this.generateToken(user._id.toString());
    return { token, user };
  }

  async login(dto: LoginDto) {
    const user = await this.userModel.findOne({ email: dto.email });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.authProvider !== 'local') {
      throw new UnauthorizedException(
        `This account uses ${user.authProvider} sign-in. Please use ${user.authProvider} to log in.`,
      );
    }

    const isMatch = await user.comparePassword(dto.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const token = this.generateToken(user._id.toString());
    return { token, user };
  }

  async googleAuth(dto: GoogleAuthDto) {
    let googleData;
    try {
      googleData = await this.oauthService.verifyGoogleToken(dto.idToken);
    } catch (error) {
      if (
        error.message.includes('Token used too late') ||
        error.message.includes('Invalid token')
      ) {
        throw new UnauthorizedException('Invalid or expired Google token.');
      }
      throw new HttpException(error.message, 500);
    }

    // Check if this Google account already exists
    let user = await this.userModel.findOne({
      authProvider: 'google',
      oauthId: googleData.oauthId,
    });

    if (user) {
      const token = this.generateToken(user._id.toString());
      return { token, user, isNewUser: false };
    }

    // Check if email is used by a local account — link it
    const existingLocalUser = await this.userModel.findOne({
      email: googleData.email,
      authProvider: 'local',
    });

    if (existingLocalUser) {
      existingLocalUser.authProvider = 'google';
      existingLocalUser.oauthId = googleData.oauthId;
      if (!existingLocalUser.avatar && googleData.avatar) {
        existingLocalUser.avatar = googleData.avatar;
      }
      await existingLocalUser.save();

      const token = this.generateToken(existingLocalUser._id.toString());
      return { token, user: existingLocalUser, isNewUser: false };
    }

    // Check if email is used by a different OAuth provider
    const existingOAuthUser = await this.userModel.findOne({
      email: googleData.email,
    });
    if (existingOAuthUser) {
      throw new ConflictException(
        `This email is already registered with ${existingOAuthUser.authProvider} sign-in.`,
      );
    }

    // New user
    user = new this.userModel({
      fname: googleData.fname || 'User',
      lname: googleData.lname || '',
      email: googleData.email,
      authProvider: 'google',
      oauthId: googleData.oauthId,
      avatar: googleData.avatar,
      isProfileComplete: false,
    });
    await user.save();

    const token = this.generateToken(user._id.toString());
    return { token, user, isNewUser: true };
  }

  async appleAuth(dto: AppleAuthDto) {
    let appleData;
    try {
      appleData = await this.oauthService.verifyAppleToken(dto.identityToken);
    } catch (error) {
      if (
        error.message.includes('Invalid') ||
        error.message.includes('expired')
      ) {
        throw new UnauthorizedException('Invalid or expired Apple token.');
      }
      throw new HttpException(error.message, 500);
    }

    // Check if this Apple account already exists
    let user = await this.userModel.findOne({
      authProvider: 'apple',
      oauthId: appleData.oauthId,
    });

    if (user) {
      const token = this.generateToken(user._id.toString());
      return { token, user, isNewUser: false };
    }

    const email = appleData.email;

    if (email) {
      // Check for existing local account — link it
      const existingLocalUser = await this.userModel.findOne({
        email,
        authProvider: 'local',
      });

      if (existingLocalUser) {
        existingLocalUser.authProvider = 'apple';
        existingLocalUser.oauthId = appleData.oauthId;
        await existingLocalUser.save();

        const token = this.generateToken(existingLocalUser._id.toString());
        return { token, user: existingLocalUser, isNewUser: false };
      }

      // Check for different OAuth provider
      const existingOAuthUser = await this.userModel.findOne({ email });
      if (existingOAuthUser) {
        throw new ConflictException(
          `This email is already registered with ${existingOAuthUser.authProvider} sign-in.`,
        );
      }
    }

    // New user
    user = new this.userModel({
      fname: dto.fname || 'User',
      lname: dto.lname || '',
      email:
        email || `apple_${appleData.oauthId}@privaterelay.appleid.com`,
      authProvider: 'apple',
      oauthId: appleData.oauthId,
      isProfileComplete: false,
    });
    await user.save();

    const token = this.generateToken(user._id.toString());
    return { token, user, isNewUser: true };
  }

  async completeProfile(userId: string, dto: CompleteProfileDto) {
    const updates: any = {
      gender: dto.gender,
      batch: dto.batch,
      isProfileComplete: true,
    };

    if (dto.fname) updates.fname = dto.fname;
    if (dto.lname) updates.lname = dto.lname;

    const user = await this.userModel.findByIdAndUpdate(userId, updates, {
      new: true,
    });

    return { user };
  }
}
