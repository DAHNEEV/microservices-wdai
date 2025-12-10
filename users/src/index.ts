import { Hono } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";
import { usersTable } from "./schema";
import { db } from "./db";
import { hash, verify } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import * as jwt from "jsonwebtoken";

const app = new Hono().basePath("/api");

const userSchema = z.object({
    email: z.email(),
    password: z.string(),
});

app.post(
    "/register",
    validator("json", (value, c) => {
        const parsed = userSchema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: "Invalid user data" }, 400);
        }
        return parsed.data;
    }),
    async (c) => {
        const data = c.req.valid("json");

        try {
            const [existingUser] = await db
                .select()
                .from(usersTable)
                .where(eq(usersTable.email, data.email))
                .limit(1);

            if (existingUser) {
                return c.json({ error: "Email is already taken" }, 409);
            }

            const passwordHash = await hash(data.password, {
                memoryCost: 19456,
                timeCost: 2,
                outputLen: 32,
                parallelism: 1,
            });

            const newUser = {
                email: data.email,
                password: passwordHash,
            };

            const [user] = await db
                .insert(usersTable)
                .values(newUser)
                .returning();

            if (!user) {
                return c.json({ error: "Cannot create user" }, 400);
            }

            return c.json({ success: true });
        } catch (error) {
            return c.json({ error: "Internal server error" }, 500);
        }
    },
);

app.post(
    "/login",
    validator("json", (value, c) => {
        const parsed = userSchema.safeParse(value);
        if (!parsed.success) {
            return c.json({ error: "Invalid user data" }, 400);
        }
        return parsed.data;
    }),
    async (c) => {
        const data = c.req.valid("json");

        try {
            const [user] = await db
                .select()
                .from(usersTable)
                .where(eq(usersTable.email, data.email))
                .limit(1);

            if (!user) {
                return c.json({ error: "Invalid user data" }, 400);
            }

            const validPassword = await verify(user.password, data.password, {
                memoryCost: 19456,
                timeCost: 2,
                outputLen: 32,
                parallelism: 1,
            });

            if (!validPassword) {
                return c.json({ error: "Invalid user data" }, 400);
            }

            const token = jwt.sign(
                { userId: user.id },
                process.env.JWT_PRIVATE_KEY!,
                {
                    algorithm: "RS256",
                },
            );

            return c.json({ token: token });
        } catch (error) {
            console.log(error);
            return c.json({ error: "Internal server error" }, 500);
        }
    },
);

export default {
    port: 3002,
    fetch: app.fetch,
};
