import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers(
      parseInt(page) || 1,
      parseInt(limit) || 20,
      search,
    );
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Get('conversations')
  getConversations(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getConversations(
      parseInt(page) || 1,
      parseInt(limit) || 20,
    );
  }

  @Get('conversations/:id/messages')
  getConversationMessages(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getConversationMessages(
      id,
      parseInt(page) || 1,
      parseInt(limit) || 30,
    );
  }
}
