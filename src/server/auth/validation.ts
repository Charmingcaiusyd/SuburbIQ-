import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().transform((email) => email.toLowerCase().trim()),
  password: z.string().min(8)
});

export const loginSchema = registerSchema;
