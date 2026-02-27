import database from './database.js';
import { logger } from './logger.js';
import config from './index.js';

const schema = `
-- Create core tables first (if they don't exist)

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(30) UNIQUE NOT NULL,
  display_name VARCHAR(50) NOT NULL,
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  phone VARCHAR(20) UNIQUE,
  avatar_url TEXT,
  bio VARCHAR(500),
  language VARCHAR(5) DEFAULT 'tr',
  status VARCHAR(30) DEFAULT 'active',
  providers JSONB DEFAULT '{}',
  interests TEXT[],
  is_admin BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Room categories table
CREATE TABLE IF NOT EXISTS room_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  description VARCHAR(255),
  icon VARCHAR(50),
  color VARCHAR(7),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Default categories
INSERT INTO room_categories (name, slug, description, icon, color, sort_order) VALUES
  ('Siyaset', 'politics', 'Siyaset ve gundem tartismalari', 'politics', '#E74C3C', 1),
  ('Ekonomi', 'economy', 'Ekonomi ve finans tartismalari', 'economy', '#27AE60', 2),
  ('Tarih', 'history', 'Tarih ve medeniyet tartismalari', 'history', '#8E44AD', 3),
  ('Bilim', 'science', 'Bilim ve teknoloji tartismalari', 'science', '#3498DB', 4),
  ('Kultur', 'culture', 'Kultur ve sanat tartismalari', 'culture', '#F39C12', 5),
  ('Spor', 'sports', 'Spor ve etkinlik tartismalari', 'sports', '#1ABC9C', 6),
  ('Teknoloji', 'technology', 'Teknoloji ve yenilik tartismalari', 'technology', '#34495E', 7),
  ('Felsefe', 'philosophy', 'Felsefe ve dusunce tartismalari', 'philosophy', '#9B59B6', 8),
  ('Din ve Inanc', 'religion', 'Din ve inanc tartismalari', 'religion', '#16A085', 9),
  ('Gundem', 'news', 'Guncel haber ve olaylar', 'news', '#E67E22', 10)
ON CONFLICT (slug) DO NOTHING;

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  category VARCHAR(50),
  category_id INTEGER REFERENCES room_categories(id),
  language VARCHAR(5) DEFAULT 'tr',
  visibility VARCHAR(10) DEFAULT 'public',
  status VARCHAR(30) DEFAULT 'creating',
  max_speakers INTEGER DEFAULT 6,
  mic_requests_enabled BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id),
  designated_successor INTEGER REFERENCES users(id),
  tags TEXT[],
  viewer_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  grace_period_end TIMESTAMP,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_created_by ON rooms(created_by);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_category_id ON rooms(category_id);
CREATE INDEX IF NOT EXISTS idx_rooms_visibility ON rooms(visibility);

-- Room participants table
CREATE TABLE IF NOT EXISTS room_participants (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL DEFAULT 'listener',
  is_muted BOOLEAN DEFAULT false,
  is_hand_raised BOOLEAN DEFAULT false,
  stage_joined_at TIMESTAMP,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_participants_room ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user ON room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_role ON room_participants(room_id, role);

-- Room bans table
CREATE TABLE IF NOT EXISTS room_bans (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  banned_by INTEGER REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_room_bans_room ON room_bans(room_id);
CREATE INDEX IF NOT EXISTS idx_room_bans_user ON room_bans(user_id);

-- User follows table
CREATE TABLE IF NOT EXISTS user_follows (
  id SERIAL PRIMARY KEY,
  follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);

-- User blocks table
CREATE TABLE IF NOT EXISTS user_blocks (
  id SERIAL PRIMARY KEY,
  blocker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  title VARCHAR(100) NOT NULL,
  message VARCHAR(255),
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

-- Audit logs table for moderation actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  target_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reports table for user reports
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reported_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason VARCHAR(100),
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Now add columns to existing tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES room_categories(id);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS viewer_count INTEGER DEFAULT 0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS grace_period_end TIMESTAMP;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS designated_successor INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Backfill audit/reports columns for legacy deployments before creating indexes
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action VARCHAR(50);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB;

ALTER TABLE reports ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reported_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reason VARCHAR(100);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;

-- Add created_at columns to tables that might exist without them
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Create new indexes (after columns exist)
CREATE INDEX IF NOT EXISTS idx_rooms_category_id ON rooms(category_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_room_id ON audit_logs(room_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id ON audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_room_id ON reports(room_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user_id ON reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
`;

interface Migration {
  version: string;
  description: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    version: '001_initial_schema',
    description: 'Initial PostgreSQL schema',
    sql: schema,
  },
  {
    version: '002_auth_status_alignment',
    description: 'Align legacy pending statuses with email/phone verification flow',
    sql: `
      ALTER TABLE users
      ALTER COLUMN status TYPE VARCHAR(50);

      UPDATE users
      SET status = 'pending_email_verification'
      WHERE status = 'pending_verification' AND email IS NOT NULL;

      UPDATE users
      SET status = 'pending_phone_verification'
      WHERE status = 'pending_verification' AND phone IS NOT NULL AND (email IS NULL OR email = '');
    `,
  },
  {
    version: '003_room_performance_indexes',
    description: 'Add composite indexes for room participant and room list/search performance',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_room_participants_room_joined_at
      ON room_participants(room_id, joined_at DESC);

      CREATE INDEX IF NOT EXISTS idx_room_participants_room_role_joined_at
      ON room_participants(room_id, role, joined_at DESC);

      CREATE INDEX IF NOT EXISTS idx_rooms_status_visibility_created_at
      ON rooms(status, visibility, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_rooms_status_category_language_created_at
      ON rooms(status, category, language, created_at DESC);
    `,
  },
  {
    version: '004_oauth_provider_indexes',
    description: 'Add provider id indexes for reliable OAuth account matching',
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_provider_id_unique
      ON users ((providers->'google'->>'id'))
      WHERE (providers ? 'google') AND (providers->'google'->>'id') IS NOT NULL AND (providers->'google'->>'id') <> '';

      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_twitter_provider_id_unique
      ON users ((providers->'twitter'->>'id'))
      WHERE (providers ? 'twitter') AND (providers->'twitter'->>'id') IS NOT NULL AND (providers->'twitter'->>'id') <> '';
    `,
  },
];

function resolveMigrationMode(): 'apply' | 'check_only' | 'skip' {
  const isProd = process.env.NODE_ENV === 'production';
  const explicitlyEnabled = process.env.RUN_MIGRATIONS === 'true';

  if (isProd && !explicitlyEnabled) {
    return config.migrations.requireUpToDate ? 'check_only' : 'skip';
  }

  return 'apply';
}

export async function runMigrations(): Promise<void> {
  const mode = resolveMigrationMode();

  if (mode === 'skip') {
    logger.warn('Skipping migrations in production (set RUN_MIGRATIONS=true to apply)');
    return;
  }

  try {
    logger.info('Running versioned database migrations...');

    if (mode === 'check_only') {
      const tableResult = await database.query(
        `SELECT to_regclass('public.schema_migrations') AS table_name`
      );
      const tableName = tableResult.rows[0]?.table_name as string | null | undefined;

      if (!tableName) {
        throw new Error(
          'schema_migrations table is missing in production; enable RUN_MIGRATIONS=true to apply migrations'
        );
      }
    } else {
      await database.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version VARCHAR(100) PRIMARY KEY,
          description TEXT NOT NULL,
          applied_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    const appliedResult = await database.query(
      'SELECT version FROM schema_migrations ORDER BY version ASC'
    );
    const applied = new Set(appliedResult.rows.map(row => row.version as string));
    const pending = migrations.filter(migration => !applied.has(migration.version));

    if (pending.length === 0) {
      logger.info('No pending migrations');
      return;
    }

    if (mode === 'check_only') {
      throw new Error(
        `Pending migrations detected in production: ${pending.map(item => item.version).join(', ')}. ` +
        'Run with RUN_MIGRATIONS=true before serving traffic.'
      );
    }

    logger.info({ count: pending.length }, 'Applying pending migrations');

    for (const migration of pending) {
      const client = await database.getPool().connect();

      try {
        await client.query('BEGIN');
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (version, description) VALUES ($1, $2)',
          [migration.version, migration.description]
        );
        await client.query('COMMIT');
        logger.info({ version: migration.version }, 'Migration applied');
      } catch (error: unknown) {
        await client.query('ROLLBACK');
        const message = error instanceof Error ? error.message : 'Unknown migration error';
        logger.error({ err: error, version: migration.version, message }, 'Migration failed');
        throw error;
      } finally {
        client.release();
      }
    }

    logger.info('Versioned database migrations completed');
  } catch (error) {
    logger.error({ err: error }, 'Migration failed');
    throw error;
  }
}

export default runMigrations;

