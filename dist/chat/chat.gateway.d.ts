import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { UserDocument } from '../users/schemas/user.schema';
import { MessageDocument } from '../messages/schemas/message.schema';
import { ConversationDocument } from '../conversations/schemas/conversation.schema';
import { FirebaseService } from '../firebase/firebase.service';
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly jwtService;
    private userModel;
    private messageModel;
    private conversationModel;
    private readonly firebaseService;
    server: Server;
    constructor(jwtService: JwtService, userModel: Model<UserDocument>, messageModel: Model<MessageDocument>, conversationModel: Model<ConversationDocument>, firebaseService: FirebaseService);
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    handleSendMessage(client: Socket, data: {
        conversationId: string;
        text?: string;
        type?: string;
    }): Promise<void>;
    handleTyping(client: Socket, data: {
        conversationId: string;
        receiverId: string;
    }): void;
    handleStopTyping(client: Socket, data: {
        conversationId: string;
        receiverId: string;
    }): void;
    handleMarkRead(client: Socket, data: {
        conversationId: string;
    }): Promise<void>;
}
