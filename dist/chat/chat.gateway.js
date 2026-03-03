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
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const jwt_1 = require("@nestjs/jwt");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_1 = require("../users/schemas/user.schema");
const message_schema_1 = require("../messages/schemas/message.schema");
const conversation_schema_1 = require("../conversations/schemas/conversation.schema");
const firebase_service_1 = require("../firebase/firebase.service");
let ChatGateway = class ChatGateway {
    constructor(jwtService, userModel, messageModel, conversationModel, firebaseService) {
        this.jwtService = jwtService;
        this.userModel = userModel;
        this.messageModel = messageModel;
        this.conversationModel = conversationModel;
        this.firebaseService = firebaseService;
    }
    async handleConnection(client) {
        try {
            const token = client.handshake.auth.token;
            if (!token) {
                client.disconnect();
                return;
            }
            const decoded = this.jwtService.verify(token);
            const user = await this.userModel.findById(decoded.userId);
            if (!user) {
                client.disconnect();
                return;
            }
            client.data.userId = user._id.toString();
            client.data.user = user;
            client.join(user._id.toString());
            console.log(`User connected: ${user.fname} ${user.lname} (${user._id})`);
            await this.userModel
                .findByIdAndUpdate(user._id, { isOnline: true })
                .exec();
            client.broadcast.emit('user-online', {
                userId: user._id.toString(),
            });
        }
        catch {
            client.disconnect();
        }
    }
    async handleDisconnect(client) {
        if (client.data.userId) {
            console.log(`User disconnected: ${client.data.user?.fname} ${client.data.user?.lname} (${client.data.userId})`);
            await this.userModel
                .findByIdAndUpdate(client.data.userId, {
                isOnline: false,
                lastSeen: new Date(),
            })
                .exec();
            client.broadcast.emit('user-offline', {
                userId: client.data.userId,
                lastSeen: new Date(),
            });
        }
    }
    async handleSendMessage(client, data) {
        try {
            const { conversationId, text, type } = data;
            const conversation = await this.conversationModel.findOne({
                _id: conversationId,
                participants: client.data.userId,
            });
            if (!conversation)
                return;
            const message = await this.messageModel.create({
                conversation: conversationId,
                sender: client.data.userId,
                type: type || 'text',
                text: text || '',
                readBy: [client.data.userId],
            });
            const populatedMessage = await this.messageModel
                .findById(message._id)
                .populate('sender', '-password');
            await this.conversationModel.findByIdAndUpdate(conversationId, {
                lastMessage: message._id,
            });
            const receiverId = conversation.participants.find((p) => p.toString() !== client.data.userId);
            if (receiverId) {
                this.server
                    .to(receiverId.toString())
                    .emit('new-message', populatedMessage);
                try {
                    const receiver = await this.userModel.findById(receiverId);
                    if (receiver && receiver.fcmToken) {
                        const notificationBody = type === 'image' ? 'Sent you an image' : text || '';
                        await this.firebaseService.sendPushNotification(receiver.fcmToken, `${client.data.user.fname} ${client.data.user.lname}`.trim(), notificationBody, {
                            conversationId: conversationId.toString(),
                            senderId: client.data.userId,
                            messageType: type || 'text',
                        });
                    }
                }
                catch (pushError) {
                    console.error('Push notification error:', pushError.message);
                }
            }
            client.emit('new-message', populatedMessage);
        }
        catch (error) {
            console.error('send-message error:', error.message);
        }
    }
    handleTyping(client, data) {
        if (data.receiverId) {
            this.server.to(data.receiverId).emit('typing', {
                conversationId: data.conversationId,
                senderId: client.data.userId,
            });
        }
    }
    handleStopTyping(client, data) {
        if (data.receiverId) {
            this.server.to(data.receiverId).emit('stop-typing', {
                conversationId: data.conversationId,
                senderId: client.data.userId,
            });
        }
    }
    async handleMarkRead(client, data) {
        try {
            const { conversationId } = data;
            await this.messageModel.updateMany({
                conversation: conversationId,
                readBy: { $ne: client.data.userId },
            }, { $addToSet: { readBy: client.data.userId } });
            const conversation = await this.conversationModel.findById(conversationId);
            if (conversation) {
                const otherUserId = conversation.participants.find((p) => p.toString() !== client.data.userId);
                if (otherUserId) {
                    this.server.to(otherUserId.toString()).emit('messages-read', {
                        conversationId,
                        readByUserId: client.data.userId,
                    });
                }
            }
        }
        catch (error) {
            console.error('mark-read error:', error.message);
        }
    }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('send-message'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleSendMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleTyping", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('stop-typing'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleStopTyping", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('mark-read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleMarkRead", null);
exports.ChatGateway = ChatGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: { origin: '*' } }),
    __param(1, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(2, (0, mongoose_1.InjectModel)(message_schema_1.Message.name)),
    __param(3, (0, mongoose_1.InjectModel)(conversation_schema_1.Conversation.name)),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        firebase_service_1.FirebaseService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map