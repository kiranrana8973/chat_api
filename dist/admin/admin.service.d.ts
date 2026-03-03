import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Conversation, ConversationDocument } from '../conversations/schemas/conversation.schema';
import { Message, MessageDocument } from '../messages/schemas/message.schema';
export declare class AdminService {
    private userModel;
    private conversationModel;
    private messageModel;
    constructor(userModel: Model<UserDocument>, conversationModel: Model<ConversationDocument>, messageModel: Model<MessageDocument>);
    getStats(): Promise<{
        totalUsers: number;
        totalConversations: number;
        totalMessages: number;
        onlineUsers: number;
    }>;
    getUsers(page?: number, limit?: number, search?: string): Promise<{
        users: (import("mongoose").Document<unknown, {}, UserDocument, {}, import("mongoose").DefaultSchemaOptions> & User & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        } & {
            id: string;
        })[];
        page: number;
        totalPages: number;
        total: number;
    }>;
    deleteUser(userId: string): Promise<{
        message: string;
    }>;
    getConversations(page?: number, limit?: number): Promise<{
        conversations: (import("mongoose").Document<unknown, {}, ConversationDocument, {}, import("mongoose").DefaultSchemaOptions> & Conversation & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        } & {
            id: string;
        })[];
        page: number;
        totalPages: number;
        total: number;
    }>;
    getConversationMessages(conversationId: string, page?: number, limit?: number): Promise<{
        messages: (import("mongoose").Document<unknown, {}, MessageDocument, {}, import("mongoose").DefaultSchemaOptions> & Message & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        } & {
            id: string;
        })[];
        page: number;
        totalPages: number;
        total: number;
    }>;
}
