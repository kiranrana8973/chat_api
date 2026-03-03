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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_1 = require("../users/schemas/user.schema");
const oauth_service_1 = require("./oauth.service");
let AuthService = class AuthService {
    constructor(userModel, jwtService, oauthService) {
        this.userModel = userModel;
        this.jwtService = jwtService;
        this.oauthService = oauthService;
    }
    generateToken(userId) {
        return this.jwtService.sign({ userId });
    }
    async register(dto) {
        const existingUser = await this.userModel.findOne({ email: dto.email });
        if (existingUser) {
            throw new common_1.BadRequestException('Email already in use.');
        }
        const user = new this.userModel({
            ...dto,
            authProvider: 'local',
            isProfileComplete: true,
        });
        await user.save();
        const token = this.generateToken(user._id.toString());
        return { token, user };
    }
    async login(dto) {
        const user = await this.userModel.findOne({ email: dto.email });
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid email or password.');
        }
        if (user.authProvider !== 'local') {
            throw new common_1.UnauthorizedException(`This account uses ${user.authProvider} sign-in. Please use ${user.authProvider} to log in.`);
        }
        const isMatch = await user.comparePassword(dto.password);
        if (!isMatch) {
            throw new common_1.UnauthorizedException('Invalid email or password.');
        }
        const token = this.generateToken(user._id.toString());
        return { token, user };
    }
    async googleAuth(dto) {
        let googleData;
        try {
            googleData = await this.oauthService.verifyGoogleToken(dto.idToken);
        }
        catch (error) {
            if (error.message.includes('Token used too late') ||
                error.message.includes('Invalid token')) {
                throw new common_1.UnauthorizedException('Invalid or expired Google token.');
            }
            throw new common_1.HttpException(error.message, 500);
        }
        let user = await this.userModel.findOne({
            authProvider: 'google',
            oauthId: googleData.oauthId,
        });
        if (user) {
            const token = this.generateToken(user._id.toString());
            return { token, user, isNewUser: false };
        }
        const existingLocalUser = await this.userModel.findOne({
            email: googleData.email,
            authProvider: 'local',
        });
        if (existingLocalUser) {
            existingLocalUser.authProvider = 'google';
            existingLocalUser.oauthId = googleData.oauthId;
            if (!existingLocalUser.avatar && googleData.avatar) {
                existingLocalUser.avatar = googleData.avatar;
            }
            await existingLocalUser.save();
            const token = this.generateToken(existingLocalUser._id.toString());
            return { token, user: existingLocalUser, isNewUser: false };
        }
        const existingOAuthUser = await this.userModel.findOne({
            email: googleData.email,
        });
        if (existingOAuthUser) {
            throw new common_1.ConflictException(`This email is already registered with ${existingOAuthUser.authProvider} sign-in.`);
        }
        user = new this.userModel({
            fname: googleData.fname || 'User',
            lname: googleData.lname || '',
            email: googleData.email,
            authProvider: 'google',
            oauthId: googleData.oauthId,
            avatar: googleData.avatar,
            isProfileComplete: false,
        });
        await user.save();
        const token = this.generateToken(user._id.toString());
        return { token, user, isNewUser: true };
    }
    async appleAuth(dto) {
        let appleData;
        try {
            appleData = await this.oauthService.verifyAppleToken(dto.identityToken);
        }
        catch (error) {
            if (error.message.includes('Invalid') ||
                error.message.includes('expired')) {
                throw new common_1.UnauthorizedException('Invalid or expired Apple token.');
            }
            throw new common_1.HttpException(error.message, 500);
        }
        let user = await this.userModel.findOne({
            authProvider: 'apple',
            oauthId: appleData.oauthId,
        });
        if (user) {
            const token = this.generateToken(user._id.toString());
            return { token, user, isNewUser: false };
        }
        const email = appleData.email;
        if (email) {
            const existingLocalUser = await this.userModel.findOne({
                email,
                authProvider: 'local',
            });
            if (existingLocalUser) {
                existingLocalUser.authProvider = 'apple';
                existingLocalUser.oauthId = appleData.oauthId;
                await existingLocalUser.save();
                const token = this.generateToken(existingLocalUser._id.toString());
                return { token, user: existingLocalUser, isNewUser: false };
            }
            const existingOAuthUser = await this.userModel.findOne({ email });
            if (existingOAuthUser) {
                throw new common_1.ConflictException(`This email is already registered with ${existingOAuthUser.authProvider} sign-in.`);
            }
        }
        user = new this.userModel({
            fname: dto.fname || 'User',
            lname: dto.lname || '',
            email: email || `apple_${appleData.oauthId}@privaterelay.appleid.com`,
            authProvider: 'apple',
            oauthId: appleData.oauthId,
            isProfileComplete: false,
        });
        await user.save();
        const token = this.generateToken(user._id.toString());
        return { token, user, isNewUser: true };
    }
    async completeProfile(userId, dto) {
        const updates = {
            gender: dto.gender,
            batch: dto.batch,
            isProfileComplete: true,
        };
        if (dto.fname)
            updates.fname = dto.fname;
        if (dto.lname)
            updates.lname = dto.lname;
        const user = await this.userModel.findByIdAndUpdate(userId, updates, {
            new: true,
        });
        return { user };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        jwt_1.JwtService,
        oauth_service_1.OAuthService])
], AuthService);
//# sourceMappingURL=auth.service.js.map