import { OnModuleInit } from '@nestjs/common';
import { Model } from 'mongoose';
import { UserDocument } from '../users/schemas/user.schema';
export declare class FirebaseService implements OnModuleInit {
    private userModel;
    private firebaseAdmin;
    constructor(userModel: Model<UserDocument>);
    onModuleInit(): void;
    sendPushNotification(fcmToken: string, title: string, body: string, data: Record<string, string>): Promise<void>;
}
