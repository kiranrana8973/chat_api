import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  Conversation,
  ConversationDocument,
} from '../conversations/schemas/conversation.schema';
import { Message, MessageDocument } from '../messages/schemas/message.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async getStats() {
    const [totalUsers, totalConversations, totalMessages, onlineUsers] =
      await Promise.all([
        this.userModel.countDocuments(),
        this.conversationModel.countDocuments(),
        this.messageModel.countDocuments(),
        this.userModel.countDocuments({ isOnline: true }),
      ]);

    return { totalUsers, totalConversations, totalMessages, onlineUsers };
  }

  async getUsers(page: number = 1, limit: number = 20, search?: string) {
    const query: any = {};

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { fname: searchRegex },
        { lname: searchRegex },
        { email: searchRegex },
      ];
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.userModel
        .find(query)
        .select('-password -oauthId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.userModel.countDocuments(query),
    ]);

    return { users, page, totalPages: Math.ceil(total / limit), total };
  }

  async deleteUser(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    // Delete user's messages, conversations, and the user
    await Promise.all([
      this.messageModel.deleteMany({ sender: userId }),
      this.conversationModel.deleteMany({ participants: userId }),
      this.userModel.findByIdAndDelete(userId),
    ]);

    return { message: 'User and associated data deleted.' };
  }

  async getConversations(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      this.conversationModel
        .find()
        .populate('participants', '-password -oauthId')
        .populate('lastMessage')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      this.conversationModel.countDocuments(),
    ]);

    return {
      conversations,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    };
  }

  async getConversationMessages(
    conversationId: string,
    page: number = 1,
    limit: number = 30,
  ) {
    const conversation =
      await this.conversationModel.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found.');
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.messageModel
        .find({ conversation: conversationId })
        .populate('sender', '-password -oauthId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.messageModel.countDocuments({ conversation: conversationId }),
    ]);

    return { messages, page, totalPages: Math.ceil(total / limit), total };
  }
}
