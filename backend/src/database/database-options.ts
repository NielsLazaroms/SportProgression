import { join } from 'path';
import { types } from 'pg';
import type { DataSourceOptions } from 'typeorm';
import { EnvKey } from '../../envKey';

// node-postgres turns DATE columns into JS Date objects at local midnight,
// which shifts the day in raw query results depending on the server time
// zone. Keep them as the plain 'YYYY-MM-DD' text the rest of the code expects.
types.setTypeParser(types.builtins.DATE, (value) => value);

type Env = (key: EnvKey) => string | undefined;

/** Folder with the compiled migration files (works from src and dist). */
export const MIGRATIONS_GLOB = join(__dirname, 'migrations', '*.{ts,js}');

/**
 * Connection settings for the PostgreSQL database. Shared by the running app
 * and the TypeORM CLI (src/database/data-source.ts), so both always talk to
 * the same database in the same way.
 */
export function postgresOptions(env: Env) {
  const sslEnabled = (env(EnvKey.DB_SSL) ?? 'false') === 'true';
  // Self-signed certificates are common for a database container on the same
  // VM; DB_SSL_REJECT_UNAUTHORIZED=false accepts them (still encrypted).
  const rejectUnauthorized = env(EnvKey.DB_SSL_REJECT_UNAUTHORIZED) !== 'false';
  return {
    type: 'postgres' as const,
    host: env(EnvKey.DB_HOST) || 'localhost',
    port: Number(env(EnvKey.DB_PORT) || 5432),
    username: env(EnvKey.DB_USER),
    password: env(EnvKey.DB_PASS),
    database: env(EnvKey.DB_NAME),
    ssl: sslEnabled ? { rejectUnauthorized } : undefined,
    // gen_random_uuid() is built into PostgreSQL 13+, so no extension (and no
    // superuser rights) is needed for the uuid primary keys.
    uuidExtension: 'pgcrypto' as const,
    logging: env(EnvKey.DB_LOGGING) === 'true',
    migrations: [MIGRATIONS_GLOB],
    migrationsTableName: 'migrations',
  } satisfies DataSourceOptions;
}
