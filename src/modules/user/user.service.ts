import { userRepository } from './user.repository.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../common/utils/app-error.js';
import { UpdateProfileInput } from '../../common/utils/validation.js';
import database from '../../config/database.js';

export class UserService {
  async findById(userId: string): Promise<any> {
    const user = await userRepository.findById(parseInt(userId));

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    return user;
  }

  async findByUsername(username: string): Promise<any> {
    const user = await userRepository.findByUsername(username);

    if (!user) {
      throw new NotFoundError('User', username);
    }

    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<any> {
    const user = await userRepository.findById(parseInt(userId));

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const updateData: Record<string, any> = {};
    if (input.displayName) updateData.display_name = input.displayName;
    if (input.bio !== undefined) updateData.bio = input.bio;
    if (input.avatarUrl !== undefined) updateData.avatar_url = input.avatarUrl;
    if (input.interests !== undefined) updateData.interests = input.interests;
    if (input.language) updateData.language = input.language;

    const updated = await userRepository.updateUser(parseInt(userId), updateData);
    return updated;
  }

  async updateUsername(userId: string, newUsername: string): Promise<any> {
    const user = await userRepository.findById(parseInt(userId));

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    if (user.username === newUsername.toLowerCase()) {
      throw new BadRequestError('New username must be different');
    }

    const existing = await userRepository.findByUsername(newUsername);

    if (existing && existing.id !== parseInt(userId)) {
      throw new ConflictError('Username already taken');
    }

    const updated = await userRepository.updateUser(parseInt(userId), {
      username: newUsername.toLowerCase()
    });

    return updated;
  }

  async getUserRooms(userId: string): Promise<any[]> {
    const result = await database.query(
      'SELECT * FROM rooms WHERE created_by = $1 AND status != $2 ORDER BY created_at DESC',
      [parseInt(userId), 'ended']
    );
    return result.rows;
  }

  async searchUsers(query: string, limit = 20): Promise<any[]> {
    return userRepository.search(query, limit);
  }

  async getPublicProfile(userId: string): Promise<any> {
    const user = await userRepository.findById(parseInt(userId));

    if (!user || user.status !== 'active') {
      throw new NotFoundError('User', userId);
    }

    return {
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      bio: user.bio,
      interests: user.interests,
      created_at: user.created_at,
    };
  }
}

export const userService = new UserService();
export default userService;
