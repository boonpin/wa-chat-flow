import { defineConfig } from 'drizzle-kit'
import path from 'path'

const dataDir = process.env.DATA_DIR || 'storage/data'

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: path.join(dataDir, 'app.db'),
  },
})
