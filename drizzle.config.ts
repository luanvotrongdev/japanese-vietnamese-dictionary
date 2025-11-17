import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  out: './dbs',
  schema: './schemas',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_FILE!,
  },
});