import { Model } from 'mongoose';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
export declare class ConversationsService {
    private conversationModel;
    constructor(conversationModel: Model<ConversationDocument>);
    createOrGet(userId: string, participantId: string): Promise<{
        conversation: ConversationDocument;
        isNew: boolean;
    }>;
    findAllForUser(userId: string): Promise<(import("mongoose").Document<unknown, {}, ConversationDocument, {}, import("mongoose").DefaultSchemaOptions> & Conversation & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    })[]>;
}
