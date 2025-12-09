import { sqliteTable, int } from "drizzle-orm/sqlite-core";

export const ordersTable = sqliteTable("orders", {
    id: int().primaryKey({ autoIncrement: true }),
    userId: int().notNull(),
    bookId: int().notNull(),
    quantity: int().notNull(),
});
