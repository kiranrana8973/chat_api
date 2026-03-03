import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { ConversationDocument } from '../conversations/schemas/conversation.schema';
export declare class MessagesService {
    private messageModel;
    private conversationModel;
    constructor(messageModel: Model<MessageDocument>, conversationModel: Model<ConversationDocument>);
    getMessages(conversationId: string, userId: string, page?: number, limit?: number): Promise<{
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
    createMessage(userId: string, conversationId: string, type: string, text: string, imageFile?: Express.Multer.File): Promise<{
        message: import("mongoose").Document<unknown, {}, MessageDocument, {}, import("mongoose").DefaultSchemaOptions> & Message & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        } & {
            id: string;
        };
        receiverId: string;
    }>;
}
