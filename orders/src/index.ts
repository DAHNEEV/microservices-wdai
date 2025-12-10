import { Context, Hono, Next } from "hono";
import { z } from "zod";
import { validator } from "hono/validator";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { ordersTable } from "./schema";
import * as jwt from "jsonwebtoken";

const app = new Hono().basePath("/api");

const idSchema = z.object({
    id: z.coerce.number(),
});

const orderSchema = z.object({
    userId: z.coerce.number().int().positive(),
    bookId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().positive().min(1),
});

const updateOrderSchema = orderSchema.partial();

async function bookExists(id: number) {
    const url = `${process.env.BOOKS_URL}/api/books/${id}`;
    try {
        const response = await fetch(url, {
            method: "HEAD",
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

type Variables = {
    user: any;
};

const verifyJwt = async (c: Context<{ Variables: Variables }>, next: Next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader) {
        return c.json({ error: "Token not provided" }, 401);
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return c.json(
            { error: "Token missing from Authorization header" },
            401,
        );
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_PUBLIC_KEY!);

        c.set("user", decoded);

        await next();
    } catch (err) {
        return c.json({ error: "Invalid token" }, 401);
    }
};

app.get(
    "/orders/:id",
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
            const orders = await db
                .select()
                .from(ordersTable)
                .where(eq(ordersTable.userId, data.id));

            return c.json(orders);
        } catch (error) {
            return c.json({ error: "Internal server error" }, 500);
        }
    },
);

app.post(
    "/orders",
    verifyJwt,
    validator("json", (value, c) => {
        const parsed = orderSchema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: "Invalid order data" }, 400);
        }
        return parsed.data;
    }),
    async (c) => {
        const data = c.req.valid("json");

        if (!(await bookExists(data.bookId))) {
            return c.json({ error: "Invalid book id" }, 404);
        }

        try {
            const [order] = await db
                .insert(ordersTable)
                .values(data)
                .returning();

            return c.json({ id: order.id });
        } catch (error) {
            return c.json({ error: "Internal server error" }, 500);
        }
    },
);

app.delete(
    "/orders/:id",
    verifyJwt,
    validator("param", (value, c) => {
        const parsed = idSchema.safeParse(value);
        if (!parsed.success) {
            return c.text("Invalid id", 400);
        }
        return parsed.data;
    }),
    async (c) => {
        const data = c.req.valid("param");

        try {
            const [deleted] = await db
                .delete(ordersTable)
                .where(eq(ordersTable.id, data.id))
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

app.patch(
    "/orders/:id",
    verifyJwt,
    validator("param", (value, c) => {
        const parsed = idSchema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: "Invalid id" }, 400);
        }
        return parsed.data;
    }),
    validator("json", (value, c) => {
        const parsed = updateOrderSchema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: "Invalid order data" }, 400);
        }
        return parsed.data;
    }),
    async (c) => {
        const paramData = c.req.valid("param");
        const jsonData = c.req.valid("json");

        if (Object.keys(jsonData).length === 0) {
            return c.json({ error: "No changes provided" }, 404);
        }

        try {
            const [order] = await db
                .update(ordersTable)
                .set(jsonData)
                .where(eq(ordersTable.id, paramData.id))
                .returning();

            if (!order) return c.json({ error: "Order not found" }, 404);

            return c.json({ id: order.id });
        } catch (error) {
            return c.json({ error: "Internal server error" }, 500);
        }
    },
);

export default {
    port: 3001,
    fetch: app.fetch,
};
