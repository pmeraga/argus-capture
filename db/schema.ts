import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
export const episodes = sqliteTable('episodes', {
 id: text('id').primaryKey(), owner: text('owner').notNull(), name: text('name').notNull(),
 createdAt: text('created_at').notNull(), status: text('status').notNull(), data: text('data').notNull(),
}, t => [index('episodes_owner_idx').on(t.owner)]);
