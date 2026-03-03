import { Response } from 'express';
import { ConversationsService } from './conversations.service';
import { UserDocument } from '../users/schemas/user.schema';
export declare class ConversationsController {
    private readonly conversationsService;
    constructor(conversationsService: ConversationsService);
    create(user: UserDocument, participantId: string, res: Response): Promise<import("./schemas/conversation.schema").ConversationDocument>;
    findAll(user: UserDocument): Promise<(import("mongoose").Document<unknown, {}, import("./schemas/conversation.schema").ConversationDocument, {}, import("mongoose").DefaultSchemaOptions> & import("./schemas/conversation.schema").Conversation & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
}
