import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const booksTable = sqliteTable("books", {
    id: int().primaryKey({ autoIncrement: true }),
    title: text().notNull(),
    author: text().notNull(),
    year: int().notNull(),
});
