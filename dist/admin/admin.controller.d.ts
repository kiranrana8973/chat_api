import { AdminService } from './admin.service';
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    getStats(): Promise<{
        totalUsers: number;
        totalConversations: number;
        totalMessages: number;
        onlineUsers: number;
    }>;
    getUsers(page?: string, limit?: string, search?: string): Promise<{
        users: (import("mongoose").Document<unknown, {}, import("../users/schemas/user.schema").UserDocument, {}, import("mongoose").DefaultSchemaOptions> & import("../users/schemas/user.schema").User & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
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
    deleteUser(id: string): Promise<{
        message: string;
    }>;
    getConversations(page?: string, limit?: string): Promise<{
        conversations: (import("mongoose").Document<unknown, {}, import("../conversations/schemas/conversation.schema").ConversationDocument, {}, import("mongoose").DefaultSchemaOptions> & import("../conversations/schemas/conversation.schema").Conversation & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
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
    getConversationMessages(id: string, page?: string, limit?: string): Promise<{
        messages: (import("mongoose").Document<unknown, {}, import("../messages/schemas/message.schema").MessageDocument, {}, import("mongoose").DefaultSchemaOptions> & import("../messages/schemas/message.schema").Message & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
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
