import { Controller, Get, Put, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UserDocument } from './schemas/user.schema';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(
    @CurrentUser() user: UserDocument,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll(user._id.toString(), search);
  }

  @Get('me')
  getMe(@CurrentUser() user: UserDocument) {
    return user;
  }

  @Put('me')
  async updateMe(
    @CurrentUser() user: UserDocument,
    @Body() body: Record<string, any>,
  ) {
    const allowedUpdates = [
      'fname',
      'lname',
      'avatar',
      'fcmToken',
      'gender',
      'batch',
    ];
    const updates: Record<string, any> = {};

    for (const key of allowedUpdates) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    return this.usersService.updateProfile(user._id.toString(), updates);
  }
}
