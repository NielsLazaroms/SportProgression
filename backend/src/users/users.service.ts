import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}
  findByGoogleId(googleId: string) {
    return this.userRepository.findOneBy({ googleId });
  }
  async findOrCreateFromGoogle(profile: {
    googleId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    picture?: string;
  }) {
    const existingUser = await this.findByGoogleId(profile.googleId);
    if (existingUser) {
      return existingUser;
    }
    const newUser = this.userRepository.create(profile);
    return this.userRepository.save(newUser);
  }
}
