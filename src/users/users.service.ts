import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findAll(excludeUserId: string, search?: string) {
    const query: any = { _id: { $ne: excludeUserId } };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { fname: searchRegex },
        { lname: searchRegex },
        { email: searchRegex },
      ];
    }

    return this.userModel
      .find(query)
      .select('-password')
      .sort({ fname: 1, lname: 1 });
  }

  async findById(id: string) {
    return this.userModel.findById(id);
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email });
  }

  async findByOAuth(authProvider: string, oauthId: string) {
    return this.userModel.findOne({ authProvider, oauthId });
  }

  async updateProfile(id: string, updates: Partial<User>) {
    return this.userModel.findByIdAndUpdate(id, updates, { new: true });
  }
}
