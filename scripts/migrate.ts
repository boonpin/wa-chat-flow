/**
 * Applies pending Drizzle migrations without booting Next.js.
 *
 * Importing the db module is enough — it runs the legacy baseline, the
 * migrations and the default seeding in order.
 */
import { getDb } from '../lib/db'

getDb()
console.log('✓ Database is up to date')
