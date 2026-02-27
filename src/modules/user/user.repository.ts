import database from '../../config/database.js';

const ALLOWED_USER_COLUMNS = new Set([
  'username', 'display_name', 'email', 'password', 'language',
  'status', 'providers', 'bio', 'avatar_url', 'interests',
  'phone', 'is_admin', 'is_verified'
]);

export class UserRepository {
  async findById(id: number): Promise<any> {
    const result = await database.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findByUsername(username: string): Promise<any> {
    const result = await database.query(
      'SELECT * FROM users WHERE username = $1',
      [username.toLowerCase()]
    );
    return result.rows[0] || null;
  }

  async findByEmail(email: string): Promise<any> {
    const result = await database.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    return result.rows[0] || null;
  }

  async findByPhone(phone: string): Promise<any> {
    const result = await database.query(
      'SELECT * FROM users WHERE phone = $1',
      [phone]
    );
    return result.rows[0] || null;
  }

  async findByProviderId(provider: 'google' | 'twitter', providerId: string): Promise<any> {
    const result = await database.query(
      `SELECT *
       FROM users
       WHERE providers -> $1 ->> 'id' = $2
       LIMIT 1`,
      [provider, providerId]
    );

    return result.rows[0] || null;
  }

  async createUser(data: {
    username: string;
    display_name: string;
    email?: string;
    password?: string;
    phone?: string;
    language?: string;
    status?: string;
    providers?: any;
  }): Promise<any> {
    const result = await database.query(
      `INSERT INTO users (username, display_name, email, password, phone, language, status, providers)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.username.toLowerCase(),
        data.display_name,
        data.email?.toLowerCase(),
        data.password,
        data.phone,
        data.language || 'tr',
        data.status || 'active',
        JSON.stringify(data.providers || {})
      ]
    );
    return result.rows[0];
  }

  async updateUser(id: number, data: Record<string, any>): Promise<any> {
    // Filter to only allowed column names to prevent SQL injection
    const keys = Object.keys(data).filter(k => ALLOWED_USER_COLUMNS.has(k));
    const values = keys.map((k) => {
      if (k === 'providers' && data[k] !== undefined && data[k] !== null) {
        return typeof data[k] === 'string' ? data[k] : JSON.stringify(data[k]);
      }
      return data[k];
    });
    if (keys.length === 0) return this.findById(id);

    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');

    const result = await database.query(
      `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0] || null;
  }

  async linkOAuthProvider(
    userId: number,
    provider: 'google' | 'twitter',
    providerData: { id: string; email?: string }
  ): Promise<any> {
    const user = await this.findById(userId);
    if (!user) {
      return null;
    }

    let currentProviders: Record<string, any> = {};
    if (user.providers && typeof user.providers === 'object') {
      currentProviders = user.providers as Record<string, any>;
    } else if (typeof user.providers === 'string') {
      try {
        const parsed = JSON.parse(user.providers);
        if (parsed && typeof parsed === 'object') {
          currentProviders = parsed as Record<string, any>;
        }
      } catch {
        currentProviders = {};
      }
    }

    const existingProviderPayload =
      currentProviders[provider] && typeof currentProviders[provider] === 'object'
        ? currentProviders[provider]
        : {};

    const nextProviders = {
      ...currentProviders,
      [provider]: {
        ...existingProviderPayload,
        id: providerData.id,
        ...(providerData.email ? { email: providerData.email } : {}),
      },
    };

    return this.updateUser(userId, { providers: nextProviders });
  }

  async search(query: string, limit: number = 20): Promise<any[]> {
    const result = await database.query(
      `SELECT id, username, display_name, avatar_url, bio 
       FROM users 
       WHERE (username ILIKE $1 OR display_name ILIKE $1) AND status = 'active'
       LIMIT $2`,
      [`%${query}%`, limit]
    );
    return result.rows;
  }
}

export const userRepository = new UserRepository();
export default userRepository;
