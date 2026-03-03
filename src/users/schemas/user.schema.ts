import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcryptjs';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  fname: string;

  @Prop({ required: true, trim: true })
  lname: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: false })
  password: string;

  @Prop({ enum: ['local', 'google', 'apple'], default: 'local' })
  authProvider: string;

  @Prop({ default: null })
  oauthId: string;

  @Prop({ enum: ['male', 'female', 'other'], default: null })
  gender: string;

  @Prop({ default: null, trim: true })
  batch: string;

  @Prop({ default: false })
  isProfileComplete: boolean;

  @Prop({ default: '' })
  avatar: string;

  @Prop({ default: '' })
  fcmToken: string;

  @Prop({ default: false })
  isOnline: boolean;

  @Prop({ default: Date.now })
  lastSeen: Date;

  @Prop({ enum: ['user', 'admin'], default: 'user' })
  role: string;

  comparePassword: (candidatePassword: string) => Promise<boolean>;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Compound unique index for OAuth
UserSchema.index(
  { authProvider: 1, oauthId: 1 },
  { unique: true, partialFilterExpression: { oauthId: { $ne: null } } },
);

// Pre-save hook for password hashing
UserSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Instance method: compare password
UserSchema.methods.comparePassword = async function (
  candidatePassword: string,
) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Strip sensitive fields from JSON output
UserSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.oauthId;
  return user;
};
