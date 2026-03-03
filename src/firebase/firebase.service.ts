import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { join } from 'path';
import { existsSync } from 'fs';
import * as admin from 'firebase-admin';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private firebaseAdmin: admin.app.App | null = null;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  onModuleInit() {
    const serviceAccountPath = join(
      __dirname,
      '..',
      '..',
      'serviceAccountKey.json',
    );

    if (existsSync(serviceAccountPath)) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const serviceAccount = require(serviceAccountPath);
      this.firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin SDK initialized.');
    } else {
      console.warn(
        'WARNING: serviceAccountKey.json not found. Push notifications are disabled.',
      );
      console.warn(
        'Download it from Firebase Console > Project Settings > Service Accounts.',
      );
    }
  }

  async sendPushNotification(
    fcmToken: string,
    title: string,
    body: string,
    data: Record<string, string>,
  ) {
    if (!this.firebaseAdmin || !fcmToken) return;

    try {
      await this.firebaseAdmin.messaging().send({
        token: fcmToken,
        notification: { title, body },
        data,
        android: { priority: 'high' as const },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      });
    } catch (error) {
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        await this.userModel.findOneAndUpdate({ fcmToken }, { fcmToken: '' });
      }
    }
  }
}
