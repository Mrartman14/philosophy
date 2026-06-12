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

export const RegisterSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Логин — минимум 3 символа")
      .max(30, "Логин — максимум 30 символов"),
    password: z
      .string()
      .min(6, "Пароль — минимум 6 символов")
      .max(72, "Слишком длинный пароль"),
    password_confirm: z.string(),
    next: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.password_confirm) {
      ctx.addIssue({
        code: "custom",
        path: ["password_confirm"],
        message: "Пароли не совпадают",
      });
    }
  });

export type RegisterInput = z.infer<typeof RegisterSchema>;
