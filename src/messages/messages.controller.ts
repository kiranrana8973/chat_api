import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MessagesService } from './messages.service';
import { ChatGateway } from '../chat/chat.gateway';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly chatGateway: ChatGateway,
    private readonly firebaseService: FirebaseService,
    private readonly usersService: UsersService,
  ) {}

  @Get(':conversationId')
  async getMessages(
    @CurrentUser() user: UserDocument,
    @Param('conversationId') conversationId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messagesService.getMessages(
      conversationId,
      user._id.toString(),
      parseInt(page) || 1,
      parseInt(limit) || 30,
    );
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const extValid = allowed.test(
          extname(file.originalname).toLowerCase(),
        );
        const mimeValid = allowed.test(file.mimetype);
        if (extValid && mimeValid) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Only image files (jpeg, jpg, png, gif, webp) are allowed.',
            ),
            false,
          );
        }
      },
    }),
  )
  async sendMessage(
    @CurrentUser() user: UserDocument,
    @Body('conversationId') conversationId: string,
    @Body('type') type: string,
    @Body('text') text: string,
    @UploadedFile() file: Express.Multer.File,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!conversationId) {
      throw new BadRequestException('conversationId is required.');
    }

    const { message, receiverId } = await this.messagesService.createMessage(
      user._id.toString(),
      conversationId,
      type,
      text,
      file,
    );

    // Emit via Socket.IO to the receiver
    if (receiverId && this.chatGateway.server) {
      this.chatGateway.server
        .to(receiverId)
        .emit('new-message', message);
    }

    // Send push notification to receiver
    if (receiverId) {
      const receiver = await this.usersService.findById(receiverId);
      if (receiver && receiver.fcmToken) {
        const notificationBody =
          type === 'image' ? 'Sent you an image' : text || '';
        await this.firebaseService.sendPushNotification(
          receiver.fcmToken,
          `${user.fname} ${user.lname}`.trim(),
          notificationBody,
          {
            conversationId: conversationId.toString(),
            senderId: user._id.toString(),
            messageType: type || 'text',
          },
        );
      }
    }

    res.status(HttpStatus.CREATED);
    return message;
  }
}
