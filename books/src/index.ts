import { Hono } from "hono";
import { db } from "./db";
import { booksTable } from "./schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { validator } from "hono/validator";

const app = new Hono().basePath("/api");

const idSchema = z.object({
    id: z.coerce.number(),
});

const bookSchema = z.object({
    title: z.string(),
    author: z.string(),
    year: z.coerce.number().int(),
});

app.get("/books", async (c) => {
    try {
        const books = await db.select().from(booksTable);

        return c.json(books);
    } catch (error) {
        return c.json({ error: "Internal server error" }, 500);
    }
});

app.get(
    "/books/:id",
    validator("param", (value, c) => {
        const parsed = idSchema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: "Invalid id" }, 400);
        }
        return parsed.data;
    }),
    async (c) => {
        const data = c.req.valid("param");

        try {
            const [book] = await db
                .select()
                .from(booksTable)
                .where(eq(booksTable.id, data.id))
                .limit(1);

            if (!book) return c.json({ error: "Book not found" }, 404);

            return c.json(book);
        } catch (error) {
            return c.json({ error: "Internal server error" }, 500);
        }
    },
);

app.post(
    "/books",
    validator("json", (value, c) => {
        const parsed = bookSchema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: "Invalid book data" }, 400);
        }
        return parsed.data;
    }),
    async (c) => {
        const data = c.req.valid("json");

        try {
            const [book] = await db.insert(booksTable).values(data).returning();

            return c.json({ id: book.id });
        } catch (error) {
            return c.json({ error: "Internal server error" }, 500);
        }
    },
);

app.delete(
    "/books/:id",
    validator("param", (value, c) => {
        const parsed = idSchema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: "Invalid id" }, 400);
        }
        return parsed.data;
    }),
    async (c) => {
        const data = c.req.valid("param");

        try {
            const [deleted] = await db
                .delete(booksTable)
                .where(eq(booksTable.id, data.id))
                .limit(1)
                .returning();

            if (!deleted) {
                return c.json({ error: "Not found" }, 404);
            }

            return c.json({ success: true });
        } catch (error) {
            return c.json({ error: "Internal server error" }, 500);
        }
    },
);

export default {
    port: 3000,
    fetch: app.fetch,
};
