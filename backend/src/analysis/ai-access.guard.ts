import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hasAiAccess } from '../common/ai-access';
import { User } from '../users/user.entity';

/** Lets only users with the AI role through (runs after the JWT guard). */
@Injectable()
export class AiAccessGuard implements CanActivate {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const userId = context.switchToHttp().getRequest().user?.userId;
    const user = userId ? await this.users.findOneBy({ id: userId }) : null;
    if (!hasAiAccess(user)) {
      throw new ForbiddenException({ code: 'analysis_forbidden' });
    }
    return true;
  }
}
