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
exports.MessagesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const message_schema_1 = require("./schemas/message.schema");
const conversation_schema_1 = require("../conversations/schemas/conversation.schema");
let MessagesService = class MessagesService {
    constructor(messageModel, conversationModel) {
        this.messageModel = messageModel;
        this.conversationModel = conversationModel;
    }
    async getMessages(conversationId, userId, page = 1, limit = 30) {
        const conversation = await this.conversationModel.findOne({
            _id: conversationId,
            participants: userId,
        });
        if (!conversation) {
            throw new common_1.NotFoundException('Conversation not found.');
        }
        const skip = (page - 1) * limit;
        const messages = await this.messageModel
            .find({ conversation: conversationId })
            .populate('sender', '-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        const total = await this.messageModel.countDocuments({
            conversation: conversationId,
        });
        return {
            messages,
            page,
            totalPages: Math.ceil(total / limit),
            total,
        };
    }
    async createMessage(userId, conversationId, type, text, imageFile) {
        const conversation = await this.conversationModel.findOne({
            _id: conversationId,
            participants: userId,
        });
        if (!conversation) {
            throw new common_1.NotFoundException('Conversation not found.');
        }
        const messageData = {
            conversation: conversationId,
            sender: userId,
            type: type || 'text',
            text: text || '',
            readBy: [userId],
        };
        if (imageFile) {
            messageData.type = 'image';
            messageData.image = `uploads/${imageFile.filename}`;
        }
        const message = await this.messageModel.create(messageData);
        const populatedMessage = await this.messageModel
            .findById(message._id)
            .populate('sender', '-password');
        await this.conversationModel.findByIdAndUpdate(conversationId, {
            lastMessage: message._id,
        });
        const receiverId = conversation.participants.find((p) => p.toString() !== userId);
        return { message: populatedMessage, receiverId: receiverId?.toString() };
    }
};
exports.MessagesService = MessagesService;
exports.MessagesService = MessagesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(message_schema_1.Message.name)),
    __param(1, (0, mongoose_1.InjectModel)(conversation_schema_1.Conversation.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], MessagesService);
//# sourceMappingURL=messages.service.js.map