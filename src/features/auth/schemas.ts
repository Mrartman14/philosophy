import "server-only";
import { z } from "zod";

export const LoginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Введите логин")
    .max(200, "Слишком длинный логин"),
  password: z
    .string()
    .min(1, "Введите пароль")
    .max(200, "Слишком длинный пароль"),
  next: z.string().optional(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
