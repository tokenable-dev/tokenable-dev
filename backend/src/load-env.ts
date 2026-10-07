import { existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Load backend `.env` before other modules evaluate `@Cron(process.env.*)`.
 * Nest ConfigModule loads too late for decorator defaults.
 */
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envPath);
}
