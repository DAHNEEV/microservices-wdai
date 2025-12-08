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
    year: z.number(),
});

app.get("/books", async (c) => {
    const books = await db.select().from(booksTable);

    return c.json(books);
});

app.get(
    "/books/:id",
    validator("param", (value, c) => {
        const parsed = idSchema.safeParse(value);
        if (!parsed.success) {
            return c.text("Invalid id", 401);
        }
        return parsed.data;
    }),
    async (c) => {
        const data = c.req.valid("param");

        const [book] = await db
            .select()
            .from(booksTable)
            .where(eq(booksTable.id, data.id))
            .limit(1);

        if (!book) return c.json({ error: "Book not found" });

        return c.json(book);
    },
);

app.post(
    "/books",
    validator("json", (value, c) => {
        const parsed = bookSchema.safeParse(value);
        if (!parsed.success) {
            return c.text("Invalid book data", 401);
        }
        return parsed.data;
    }),
    async (c) => {
        const data = c.req.valid("json");

        const [book] = await db.insert(booksTable).values(data).returning();

        return c.json({ id: book.id });
    },
);

app.delete(
    "/books/:id",
    validator("param", (value, c) => {
        const parsed = idSchema.safeParse(value);
        if (!parsed.success) {
            return c.text("Invalid id", 401);
        }
        return parsed.data;
    }),
    async (c) => {
        const data = c.req.valid("param");

        await db.delete(booksTable).where(eq(booksTable.id, data.id)).limit(1);

        return c.json({ success: true });
    },
);

export default app;
