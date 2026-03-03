import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  BadRequestException,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ConversationsService } from './conversations.service';
import { UserDocument } from '../users/schemas/user.schema';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  async create(
    @CurrentUser() user: UserDocument,
    @Body('participantId') participantId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!participantId) {
      throw new BadRequestException('participantId is required.');
    }

    if (participantId === user._id.toString()) {
      throw new BadRequestException(
        'Cannot create conversation with yourself.',
      );
    }

    const { conversation, isNew } =
      await this.conversationsService.createOrGet(
        user._id.toString(),
        participantId,
      );

    res.status(isNew ? HttpStatus.CREATED : HttpStatus.OK);
    return conversation;
  }

  @Get()
  async findAll(@CurrentUser() user: UserDocument) {
    return this.conversationsService.findAllForUser(user._id.toString());
  }
}
