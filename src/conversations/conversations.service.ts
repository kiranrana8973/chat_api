import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>,
  ) {}

  async createOrGet(
    userId: string,
    participantId: string,
  ): Promise<{ conversation: ConversationDocument; isNew: boolean }> {
    // Check if conversation already exists
    let conversation = await this.conversationModel
      .findOne({
        participants: { $all: [userId, participantId] },
      })
      .populate('participants', '-password')
      .populate('lastMessage');

    if (conversation) {
      return { conversation, isNew: false };
    }

    // Create new conversation
    const newConv = new this.conversationModel({
      participants: [userId, participantId],
    });
    await newConv.save();

    conversation = await this.conversationModel
      .findById(newConv._id)
      .populate('participants', '-password')
      .populate('lastMessage');

    return { conversation, isNew: true };
  }

  async findAllForUser(userId: string) {
    return this.conversationModel
      .find({ participants: userId })
      .populate('participants', '-password')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });
  }
}
