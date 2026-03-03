"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_1 = require("../users/schemas/user.schema");
const conversation_schema_1 = require("../conversations/schemas/conversation.schema");
const message_schema_1 = require("../messages/schemas/message.schema");
let AdminService = class AdminService {
    constructor(userModel, conversationModel, messageModel) {
        this.userModel = userModel;
        this.conversationModel = conversationModel;
        this.messageModel = messageModel;
    }
    async getStats() {
        const [totalUsers, totalConversations, totalMessages, onlineUsers] = await Promise.all([
            this.userModel.countDocuments(),
            this.conversationModel.countDocuments(),
            this.messageModel.countDocuments(),
            this.userModel.countDocuments({ isOnline: true }),
        ]);
        return { totalUsers, totalConversations, totalMessages, onlineUsers };
    }
    async getUsers(page = 1, limit = 20, search) {
        const query = {};
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
    async deleteUser(userId) {
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new common_1.NotFoundException('User not found.');
        }
        await Promise.all([
            this.messageModel.deleteMany({ sender: userId }),
            this.conversationModel.deleteMany({ participants: userId }),
            this.userModel.findByIdAndDelete(userId),
        ]);
        return { message: 'User and associated data deleted.' };
    }
    async getConversations(page = 1, limit = 20) {
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
    async getConversationMessages(conversationId, page = 1, limit = 30) {
        const conversation = await this.conversationModel.findById(conversationId);
        if (!conversation) {
            throw new common_1.NotFoundException('Conversation not found.');
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
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(1, (0, mongoose_1.InjectModel)(conversation_schema_1.Conversation.name)),
    __param(2, (0, mongoose_1.InjectModel)(message_schema_1.Message.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], AdminService);
//# sourceMappingURL=admin.service.js.map