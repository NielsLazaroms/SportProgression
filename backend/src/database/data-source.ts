import 'reflect-metadata';
import { join } from 'path';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { EnvKey } from '../../envKey';
import { postgresOptions } from './database-options';

// The TypeORM CLI runs outside Nest, so read backend/.env (from the current
// folder) ourselves. Values already set in the environment (Kubernetes,
// Docker) win over the file.
config({ quiet: true });

/**
 * Data source for the TypeORM CLI (migrations). The app itself connects
 * through TypeOrmModule in app.module.ts with the same settings.
 */
export default new DataSource({
  ...postgresOptions((key: EnvKey) => process.env[key]),
  // The CLI cannot use autoLoadEntities, so point it at the entity files.
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
});
