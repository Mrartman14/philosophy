// src/features/auth/client.ts
// Публичный CLIENT-safe вход слайса auth (конвенции §2.1): только изоморфные /
// edge-safe модули, без server-only. cookie-config — чистые константы имён cookie
// и их max-age + фабрика опций; нужны Edge-middleware (src/proxy.ts) и тестам.
// Через index.ts их тянуть нельзя — там реэкспорт server-only actions, которые
// утекли бы в middleware/client-бандл.
export * from "./cookie-config";
