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
exports.MessagesController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const path_1 = require("path");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const messages_service_1 = require("./messages.service");
const chat_gateway_1 = require("../chat/chat.gateway");
const firebase_service_1 = require("../firebase/firebase.service");
const users_service_1 = require("../users/users.service");
let MessagesController = class MessagesController {
    constructor(messagesService, chatGateway, firebaseService, usersService) {
        this.messagesService = messagesService;
        this.chatGateway = chatGateway;
        this.firebaseService = firebaseService;
        this.usersService = usersService;
    }
    async getMessages(user, conversationId, page, limit) {
        return this.messagesService.getMessages(conversationId, user._id.toString(), parseInt(page) || 1, parseInt(limit) || 30);
    }
    async sendMessage(user, conversationId, type, text, file, res) {
        if (!conversationId) {
            throw new common_1.BadRequestException('conversationId is required.');
        }
        const { message, receiverId } = await this.messagesService.createMessage(user._id.toString(), conversationId, type, text, file);
        if (receiverId && this.chatGateway.server) {
            this.chatGateway.server
                .to(receiverId)
                .emit('new-message', message);
        }
        if (receiverId) {
            const receiver = await this.usersService.findById(receiverId);
            if (receiver && receiver.fcmToken) {
                const notificationBody = type === 'image' ? 'Sent you an image' : text || '';
                await this.firebaseService.sendPushNotification(receiver.fcmToken, `${user.fname} ${user.lname}`.trim(), notificationBody, {
                    conversationId: conversationId.toString(),
                    senderId: user._id.toString(),
                    messageType: type || 'text',
                });
            }
        }
        res.status(common_1.HttpStatus.CREATED);
        return message;
    }
};
exports.MessagesController = MessagesController;
__decorate([
    (0, common_1.Get)(':conversationId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('conversationId')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "getMessages", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('image', {
        storage: (0, multer_1.diskStorage)({
            destination: './uploads',
            filename: (req, file, cb) => {
                const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${(0, path_1.extname)(file.originalname)}`;
                cb(null, uniqueName);
            },
        }),
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            const allowed = /jpeg|jpg|png|gif|webp/;
            const extValid = allowed.test((0, path_1.extname)(file.originalname).toLowerCase());
            const mimeValid = allowed.test(file.mimetype);
            if (extValid && mimeValid) {
                cb(null, true);
            }
            else {
                cb(new common_1.BadRequestException('Only image files (jpeg, jpg, png, gif, webp) are allowed.'), false);
            }
        },
    })),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)('conversationId')),
    __param(2, (0, common_1.Body)('type')),
    __param(3, (0, common_1.Body)('text')),
    __param(4, (0, common_1.UploadedFile)()),
    __param(5, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "sendMessage", null);
exports.MessagesController = MessagesController = __decorate([
    (0, common_1.Controller)('messages'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [messages_service_1.MessagesService,
        chat_gateway_1.ChatGateway,
        firebase_service_1.FirebaseService,
        users_service_1.UsersService])
], MessagesController);
//# sourceMappingURL=messages.controller.js.map