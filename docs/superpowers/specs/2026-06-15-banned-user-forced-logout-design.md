# Дизайн: форс-логаут и зачистка локальных данных при бане

**Дата:** 2026-06-15
**Тип:** foundation-update (трогает `src/utils/*`, root layout, auth — координированно, не фича-слайс).
**Контекст:** нужно, чтобы при бане пользователя его локальный сторадж (localStorage + IndexedDB + Cache Storage офлайна) и все авторизационные данные (httpOnly-cookie `token`) были полностью очищены, а сам пользователь — разлогинен с понятным сообщением.

## Постановка задачи

Бэкенд `philosophy-api` уже является единственной точкой enforcement: для забаненного аккаунта он отдаёт `403` и на `GET /api/me` (код `BANNED`), и на **каждую** мутирующую ручку. То есть забаненный физически не может ни прочитать защищённые данные, ни выполнить мутацию. Задача фронта — не «заблокировать» (это уже сделано), а **реактивно заметить бан, разлогинить и прибрать за собой**.

Сейчас этого не происходит: `getMe()` ([src/utils/me.ts](../../../src/utils/me.ts)) сворачивает `401/403/404` → `null`, поэтому забаненный неотличим от гостя и от протухшего токена. Его офлайн-данные и owner-маркер остаются на устройстве.

## Решение (research-backed)

Подтверждено фокусным ресерчем (OWASP, Next.js docs, Auth0/Firebase/OIDC, MDN Clear-Site-Data, CVE-2025-29927):

1. **Реактивный детект — индустриальный стандарт.** Auth0/Firebase/OIDC распространяют отзыв сессии на следующем запросе, а не через клиентский ban-watcher. Авторитетная точка — серверная (наш бэк 403).
2. **Риск idle-юзера низкий и ограниченный** — единственная экспозиция — уже отрисованные данные текущей страницы. Reactive-only — принятая позиция; heartbeat — UX-удобство, не требование безопасности.
3. **Ban-чек в edge-middleware — анти-паттерн.** Next.js: в middleware только оптимистичное чтение cookie, «avoid database checks», «не единственная линия защиты». CVE-2025-29927: заголовок `x-middleware-subrequest` обходит middleware целиком. Авторитетный чек остаётся на data-layer (`getMe`).
4. **Heartbeat/poll не строим.** Настоящий instant-logout — это server-push (OIDC back-channel logout), требующий IdP-инфры, которой нет. Bespoke-heartbeat — не индустриальная практика; оправдан только compliance-SLA, которого у проекта нет.
5. **Канонический механизм зачистки** — заголовок `Clear-Site-Data` на ответе форс-логаута (декларативно: cookie + localStorage + IndexedDB + unregister SW). Caveat: `"cache"` сломан в Chrome, `"storage"` частично в Safari → Cache Storage чистим клиентским JS. Заголовок — defense-in-depth, не несущая конструкция.

**Scope:** реагируем только на `banned` (перманентный). `suspended` приходит как обычный `Me` со `status:"suspended"` (бэк не 403-ит его на `/api/me`), обратим — зачистку ему не делаем, существующая branded-ветка «Аккаунт ограничен» сохраняется.

## Поток

```text
[Навигация] root layout: getMe() → getBanSignal()=true ─┐
                                                          ├─→ redirect("/auth/forced-logout")
[Действие]  server action: бэк 403 BANNED → BannedError ─┘            │
                                                                      ▼
                              Route Handler /auth/forced-logout:
                              • clearAuthCookie()  (httpOnly — только сервер)
                              • Clear-Site-Data: "cookies", "storage"  (defense-in-depth)
                              • 303 → /login?blocked=1
                                                                      ▼
                              /login?blocked=1:
                              • брендированный notice «Ваш аккаунт заблокирован»
                              • client effect: wipeOfflineData() + clearOfflineOwner()
```

Единая точка убийства сессии — route handler; оба детекта только маршрутизируют браузер туда. **Цикла нет:** после очистки cookie `getMe()→null`, бан больше не триггерится.

## Компоненты

### 1. Детект на навигации — `src/utils/me.ts` (🔒 foundation)

Рефактор без изменения публичного контракта `getMe(): Me | null` (у него ~40 callers):

```ts
const getAuthState = cache(async (): Promise<{ me: Me | null; banned: boolean }> => {
  // нет токена → { me: null, banned: false }
  // 200 → { me, banned: false }
  // 401 / 404 → { me: null, banned: false }   (гость / токен отозван-протух)
  // 403 + тело code === "BANNED" → { me: null, banned: true }
  // 403 прочее → { me: null, banned: false }
  // 5xx → throw (как сейчас — инцидент, не «гость»)
});

export const getMe = async (): Promise<MaybeMe> => (await getAuthState()).me;
export const getBanSignal = async (): Promise<boolean> => (await getAuthState()).banned;
```

- Один fetch на запрос (дедуп через `React.cache` на `getAuthState`).
- На `403` читаем JSON-тело и проверяем `code`. Парсинг тела best-effort: сбой/нет кода → трактуем как небанный `403` → `null` (текущее поведение).
- Все существующие callers `getMe()` не затронуты.

### 2. Детект на действии — `src/utils/api-error.ts` + `src/utils/create-action.ts` (🔒 foundation)

- [permissions.ts](../../../src/utils/permissions.ts): новый класс `BannedError` рядом с `ForbiddenError`. Отдельный класс, а не новый `reason` у `ForbiddenError`: бан — это не «отказ в праве», а форс-логаут по состоянию аккаунта, и его обработка (redirect) принципиально иная.
- [api-error.ts](../../../src/utils/api-error.ts): `BANNED` отделяется от `SUSPENDED`. `BANNED` → `throw new BannedError()`. `SUSPENDED` → `ForbiddenError("status")` без изменений.
- [create-action.ts](../../../src/utils/create-action.ts): в `catch` обёрток `createAction`/`createFormAction` — **первой проверкой** `if (error instanceof BannedError) redirect("/auth/forced-logout")` (до `isNextInternalError` и `toResult`). `redirect()` бросает `NEXT_REDIRECT`, который рантайм server action превращает в клиентский редирект.

**Следствие:** новый код в `ActionResult` не нужен, формы трогать не надо — реакция централизована в одной обёртке, браузер уходит на форс-логаут.

### 3. Точка убийства сессии — `src/app/auth/forced-logout/route.ts` (NEW)

Route Handler (`GET`):
- `clearAuthCookie()` — удаляет httpOnly-cookie `token` (JS не может).
- Заголовок `Clear-Site-Data: "cookies", "storage"` — defense-in-depth (декларативно чистит cookie + localStorage + IndexedDB + unregister SW; кросс-браузерно ненадёжен, поэтому несущая зачистка — в п.4).
- `303` → `/login?blocked=1`.

### 4. Несущая зачистка на клиенте — `ForcedLogoutCleanup` (NEW, client)

`"use client"`-компонент, монтируется на `/login?blocked=1`, один раз в `useEffect` (best-effort, не бросает):
- `wipeOfflineData()` ([src/services/offline/wipe.ts](../../../src/services/offline/wipe.ts)) — Cache Storage + IndexedDB + LRU-кэши (надёжно, кросс-браузерно).
- `clearOfflineOwner()` — **новый** best-effort хелпер в [src/services/offline/owner.ts](../../../src/services/offline/owner.ts): `localStorage.removeItem(OFFLINE_OWNER_KEY)`.

`OFFLINE_OWNER_KEY` — единственный ключ приложения в localStorage, так что `wipeOfflineData() + clearOfflineOwner()` = полная локальная зачистка.

### 5. Брендированный UX — `src/app/login/page.tsx`

Читаем `searchParams.blocked`; при `=== "1"`:
- рендерим notice (рядом с существующим `registered`-блоком): «Ваш аккаунт заблокирован. Обратитесь в поддержку.» — дженерик, без деталей (не кормить ban-evasion);
- монтируем `ForcedLogoutCleanup`.

Страница уже зовёт `getMe()` и редиректит залогиненного; после очистки cookie `getMe()→null`, рендер блока проходит штатно, цикла нет.

## Затрагиваемые файлы

| Файл | Зона | Изменение |
|---|---|---|
| `src/utils/me.ts` | 🔒 frozen | `getAuthState` + `getBanSignal`; контракт `getMe` цел |
| `src/utils/api-error.ts` | 🔒 frozen | `BANNED` → distinct-ошибка (отделить от `SUSPENDED`) |
| `src/utils/create-action.ts` | 🔒 frozen | catch → `redirect("/auth/forced-logout")` |
| `src/app/layout.tsx` | 🔒 frozen | `getBanSignal()` → `redirect` |
| `src/services/offline/owner.ts` | 🔒 infra | `clearOfflineOwner()` |
| `src/app/login/page.tsx` | — | `blocked=1` notice + cleanup |
| `src/app/auth/forced-logout/route.ts` | NEW | route handler |
| `src/.../forced-logout-cleanup.tsx` | NEW | client wipe (размещение уточнить в плане) |

## Тестирование

- `src/utils/me.test.ts` (**НОВЫЙ**): нет токена→null; 200→me; 401/404→null+`banned:false`; **403+BANNED→null+`banned:true`**; 403-прочее→null+`banned:false`; 5xx→throw.
- `src/utils/api-error.test.ts`: `BANNED`→distinct-ошибка; `SUSPENDED`→`ForbiddenError("status")` (регресс — поведение не изменилось).
- `create-action`: distinct-ban-ошибка → пробрасывается `NEXT_REDIRECT` на `/auth/forced-logout`.
- route handler: cookie очищена + заголовок `Clear-Site-Data` + `303` на `/login?blocked=1`.
- `ForcedLogoutCleanup`: на mount зовёт `wipeOfflineData()` и `clearOfflineOwner()` (моки).
- Перед PR зелёные: `pnpm lint && pnpm test && pnpm build`.

## Известные ограничения (осознанные)

- **Idle-юзер** не разлогинивается до следующего запроса/действия — принятая reactive-only позиция (бэк = единственный gate, idle-риск низкий).
- **Окно офлайн-`/saved`:** до ближайшего взаимодействия idle-забаненный может открыть **свои** сохранённые лекции офлайн; данные стираются на реакции; сценарий «чужое устройство» закрывает существующий `OfflineIdentityGuard` при следующем входе.
- Без heartbeat/push: не индустриальная практика для bespoke; push требует IdP-инфраструктуры, которой нет.

## Вне scope

- Реакция на `suspended` (обратим, не 403-ится на `/api/me`).
- Real-time/instant logout (server-push / back-channel logout).
- Изменения бэкенда (enforcement уже полный).
