import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import {
  Conversation,
  ConversationDocument,
} from '../conversations/schemas/conversation.schema';

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>,
  ) {}

  async getMessages(
    conversationId: string,
    userId: string,
    page: number = 1,
    limit: number = 30,
  ) {
    // Verify user is a participant
    const conversation = await this.conversationModel.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    const skip = (page - 1) * limit;

    const messages = await this.messageModel
      .find({ conversation: conversationId })
      .populate('sender', '-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await this.messageModel.countDocuments({
      conversation: conversationId,
    });

    return {
      messages,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    };
  }

  async createMessage(
    userId: string,
    conversationId: string,
    type: string,
    text: string,
    imageFile?: Express.Multer.File,
  ) {
    // Verify user is a participant
    const conversation = await this.conversationModel.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    const messageData: any = {
      conversation: conversationId,
      sender: userId,
      type: type || 'text',
      text: text || '',
      readBy: [userId],
    };

    // If image was uploaded
    if (imageFile) {
      messageData.type = 'image';
      messageData.image = `uploads/${imageFile.filename}`;
    }

    const message = await this.messageModel.create(messageData);
    const populatedMessage = await this.messageModel
      .findById(message._id)
      .populate('sender', '-password');

    // Update conversation's lastMessage
    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
    });

    // Find the receiver
    const receiverId = conversation.participants.find(
      (p) => p.toString() !== userId,
    );

    return { message: populatedMessage, receiverId: receiverId?.toString() };
  }
}
