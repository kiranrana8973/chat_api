import { Response } from 'express';
import { MessagesService } from './messages.service';
import { ChatGateway } from '../chat/chat.gateway';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
export declare class MessagesController {
    private readonly messagesService;
    private readonly chatGateway;
    private readonly firebaseService;
    private readonly usersService;
    constructor(messagesService: MessagesService, chatGateway: ChatGateway, firebaseService: FirebaseService, usersService: UsersService);
    getMessages(user: UserDocument, conversationId: string, page?: string, limit?: string): Promise<{
        messages: (import("mongoose").Document<unknown, {}, import("./schemas/message.schema").MessageDocument, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/message.schema").Message & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
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
    sendMessage(user: UserDocument, conversationId: string, type: string, text: string, file: Express.Multer.File, res: Response): Promise<import("mongoose").Document<unknown, {}, import("./schemas/message.schema").MessageDocument, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/message.schema").Message & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
}
