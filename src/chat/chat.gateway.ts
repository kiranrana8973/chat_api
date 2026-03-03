import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Message, MessageDocument } from '../messages/schemas/message.schema';
import {
  Conversation,
  ConversationDocument,
} from '../conversations/schemas/conversation.schema';
import { FirebaseService } from '../firebase/firebase.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>,
    private readonly firebaseService: FirebaseService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const decoded = this.jwtService.verify(token);
      const user = await this.userModel.findById(decoded.userId);
      if (!user) {
        client.disconnect();
        return;
      }

      client.data.userId = user._id.toString();
      client.data.user = user;
      client.join(user._id.toString());

      console.log(
        `User connected: ${user.fname} ${user.lname} (${user._id})`,
      );

      // Mark user as online
      await this.userModel
        .findByIdAndUpdate(user._id, { isOnline: true })
        .exec();
      client.broadcast.emit('user-online', {
        userId: user._id.toString(),
      });
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    if (client.data.userId) {
      console.log(
        `User disconnected: ${client.data.user?.fname} ${client.data.user?.lname} (${client.data.userId})`,
      );

      await this.userModel
        .findByIdAndUpdate(client.data.userId, {
          isOnline: false,
          lastSeen: new Date(),
        })
        .exec();

      client.broadcast.emit('user-offline', {
        userId: client.data.userId,
        lastSeen: new Date(),
      });
    }
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
    client: Socket,
    data: { conversationId: string; text?: string; type?: string },
  ) {
    try {
      const { conversationId, text, type } = data;

      // Verify participation
      const conversation = await this.conversationModel.findOne({
        _id: conversationId,
        participants: client.data.userId,
      });

      if (!conversation) return;

      // Create message
      const message = await this.messageModel.create({
        conversation: conversationId,
        sender: client.data.userId,
        type: type || 'text',
        text: text || '',
        readBy: [client.data.userId],
      });

      const populatedMessage = await this.messageModel
        .findById(message._id)
        .populate('sender', '-password');

      // Update conversation lastMessage
      await this.conversationModel.findByIdAndUpdate(conversationId, {
        lastMessage: message._id,
      });

      // Find receiver
      const receiverId = conversation.participants.find(
        (p) => p.toString() !== client.data.userId,
      );

      if (receiverId) {
        // Emit to receiver
        this.server
          .to(receiverId.toString())
          .emit('new-message', populatedMessage);

        // Send push notification
        try {
          const receiver = await this.userModel.findById(receiverId);
          if (receiver && receiver.fcmToken) {
            const notificationBody =
              type === 'image' ? 'Sent you an image' : text || '';
            await this.firebaseService.sendPushNotification(
              receiver.fcmToken,
              `${client.data.user.fname} ${client.data.user.lname}`.trim(),
              notificationBody,
              {
                conversationId: conversationId.toString(),
                senderId: client.data.userId,
                messageType: type || 'text',
              },
            );
          }
        } catch (pushError) {
          console.error('Push notification error:', pushError.message);
        }
      }

      // Emit back to sender for confirmation
      client.emit('new-message', populatedMessage);
    } catch (error) {
      console.error('send-message error:', error.message);
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    client: Socket,
    data: { conversationId: string; receiverId: string },
  ) {
    if (data.receiverId) {
      this.server.to(data.receiverId).emit('typing', {
        conversationId: data.conversationId,
        senderId: client.data.userId,
      });
    }
  }

  @SubscribeMessage('stop-typing')
  handleStopTyping(
    client: Socket,
    data: { conversationId: string; receiverId: string },
  ) {
    if (data.receiverId) {
      this.server.to(data.receiverId).emit('stop-typing', {
        conversationId: data.conversationId,
        senderId: client.data.userId,
      });
    }
  }

  @SubscribeMessage('mark-read')
  async handleMarkRead(
    client: Socket,
    data: { conversationId: string },
  ) {
    try {
      const { conversationId } = data;

      await this.messageModel.updateMany(
        {
          conversation: conversationId,
          readBy: { $ne: client.data.userId },
        },
        { $addToSet: { readBy: client.data.userId } },
      );

      // Notify the other participant
      const conversation =
        await this.conversationModel.findById(conversationId);
      if (conversation) {
        const otherUserId = conversation.participants.find(
          (p) => p.toString() !== client.data.userId,
        );
        if (otherUserId) {
          this.server.to(otherUserId.toString()).emit('messages-read', {
            conversationId,
            readByUserId: client.data.userId,
          });
        }
      }
    } catch (error) {
      console.error('mark-read error:', error.message);
    }
  }
}
