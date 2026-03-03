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
exports.ConversationsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const conversation_schema_1 = require("./schemas/conversation.schema");
let ConversationsService = class ConversationsService {
    constructor(conversationModel) {
        this.conversationModel = conversationModel;
    }
    async createOrGet(userId, participantId) {
        let conversation = await this.conversationModel
            .findOne({
            participants: { $all: [userId, participantId] },
        })
            .populate('participants', '-password')
            .populate('lastMessage');
        if (conversation) {
            return { conversation, isNew: false };
        }
        const newConv = new this.conversationModel({
            participants: [userId, participantId],
        });
        await newConv.save();
        conversation = await this.conversationModel
            .findById(newConv._id)
            .populate('participants', '-password')
            .populate('lastMessage');
        return { conversation, isNew: true };
    }
    async findAllForUser(userId) {
        return this.conversationModel
            .find({ participants: userId })
            .populate('participants', '-password')
            .populate('lastMessage')
            .sort({ updatedAt: -1 });
    }
};
exports.ConversationsService = ConversationsService;
exports.ConversationsService = ConversationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(conversation_schema_1.Conversation.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], ConversationsService);
//# sourceMappingURL=conversations.service.js.map