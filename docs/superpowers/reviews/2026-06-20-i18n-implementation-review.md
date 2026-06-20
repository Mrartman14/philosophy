# Ревью i18n-реализации проекта philosophy

Дата: 2026-06-20
Режим: только чтение. Все находки сверены с исходниками (file:line).
Скоуп: UI-only i18n (chrome переведён, контент/лекции — русские), языки ru|en, дефолт ru, фасад @/i18n за next-intl ^4.13.

## Общая оценка зрелости

Реализация зрелая и дисциплинированная. Подтверждено по коду:

- **Герметичность фасада по импортам** — Guardrail 5 в eslint.config форсит запрет прямого `next-intl` вне `src/i18n/**`; прикладной код ходит только через `@/i18n` / `@/i18n/client`.
- **Key-parity ru/en** — `Messages = typeof ru` + `en satisfies Messages` ловит дрейф в tsc; рантайм-тест `messages.test.ts:19` дублирует это `Set(flatKeys)`-сравнением. Симметрия идеальна: 0 расхождений ключей и 0 расхождений ICU-аргументов на 29 namespace (адверсариально перепроверено многострочным парсером).
- **Lib-независимые seam'ы** — `getFmt(locale)` (format.ts) поверх нативного `Intl.*` с кешем инстансов; locale-резолв (resolve.ts / locale.server.ts) до Intl. Эти части свопа честно чистые.
- **3 деликатных паттерна** реализованы корректно: Zod-фабрики `makeXSchema(t)`, api-error code→ключ через `resolveErrorMessage`, branded forbidden. Изоморфный офлайн-контракт (prop-resolved лейблы с ru-дефолтами, hook-free) выдержан.
- **Bundle-seam** — `SERVER_ONLY_NAMESPACES = ["validation","metadata"]` исключаются из клиентского провайдера (`toClientMessages`), guard-тест `server-only-namespaces.test.ts`.

Главная слабость не в архитектуре, а в **одном корректностном баге** (локаль даты комментария) и в том, что **заявление «своп = один модуль» защищено только код-ревью**, не машинно (типовая утечка + доступность `t.rich/.markup/select`).

## Сводка по severity

| Severity | Кол-во |
|---|---|
| Critical | 0 |
| Important | 2 |
| Minor | 15 |
| Optimization | 12 |

---

## Ось 1. Архитектура и свопабельность

Фасад делает то, ради чего создан (surface-restriction + format/locale seam). Но «переписать один модуль» — оптимистично по двум линиям, не упомянутым в docs §«Реальная цена свопа».

| # | Severity | Находка | file:line | Доказательство |
|---|---|---|---|---|
| A1 | minor | `t.rich`/`t.markup`/`select` доступны прикладному коду — запрет держится только соглашением + код-ревью (Guardrail 5 ловит импорт, не вызовы методов). Прямое противоречие инварианту «простое подмножество ICU → дешёвый своп». | src/i18n/client.tsx:16 | `export const useT = useTranslations;` — re-export целиком; docs/frontend-i18n.md:36 признаёт дыру |
| A2 | optimization | Типовая утечка next-intl в публичную поверхность: `NamespaceT<NS>` и `ErrorsT` = тип переводчика next-intl, расползается параметром `t` по ~15 schemas.ts. При свопе меняется вместе с библиотекой. | src/i18n/index.ts:26-28; client.tsx:25 | `NamespaceT = Awaited<ReturnType<typeof getTranslations<NS>>>` |
| A3 | optimization | Key-safety живёт в `declare module "next-intl" { AppConfig }` — ещё одна точка привязки, не перечисленная в «цене свопа». | src/i18n/next-intl.d.ts:6-11 | `interface AppConfig { Locale; Messages }` |
| A4 | optimization | `resolveErrorMessage` в fallback-ветке создаёт `createTranslator` на КАЖДЫЙ вызов (юнит-тесты, прогретый кеш) — ICU парсится заново. Рядом getFmt кеширует Intl-инстансы, тут дисциплина не применена. | src/i18n/index.ts:54-61 | `createTranslator({...loadMessages(DEFAULT_LOCALE)...})` внутри catch |
| A5 | optimization | `toClientMessages` исключает namespaces только top-level: `errors` едет на клиент целиком, хотя api-коды (REF_NOT_FOUND, VERSION_MISMATCH, IDEMPOTENCY_*) резолвятся ИСКЛЮЧИТЕЛЬНО на сервере; клиент использует ~5 ключей errors. | src/i18n/messages/index.ts:21,28-33 | граница server/client проходит по ключам внутри errors, а гранулярность = namespace |
| A6 | optimization | `getClientMessages` фильтрует полный каталог `Object.fromEntries` на каждый RootLayout-рендер; результат детерминирован по локали (2 варианта) и мог бы кешироваться. | src/i18n/index.ts:74-77 | `const all = await getIntlMessages(); return toClientMessages(all);` |
| A7 | optimization | `makeEntityRefResolver` — изящный изоморфный паттерн, но список типов задан ДВАЖДЫ: LABELS (ru-дефолты) и ENTITY_TYPES (массив). Нет single source of truth. | src/features/canvas/entity-ref.ts:20-31,65-76 | два параллельных списка из 10 типов |
| A8 | optimization | Per-namespace barrel масштабируем, но добавление ns = 4 ручных синхронных правки; ru/index и en/index дублируют список из 29 импортов+29 ключей. satisfies ловит частично (пропущенный в одном — да, забытый в обоих — нет). | src/i18n/messages/ru/index.ts:9-67 | два идентичных по форме барреля |

**Подтверждено по коду:** next-intl ^4.13 (precompile доступен, НЕ включён в next.config.ts); единственный глобальный I18nProvider в layout.tsx:98 с полным client-каталогом через getClientMessages().

---

## Ось 2. DRY (дубли значений и кода)

Дублирование строковых значений между namespace — **норма i18n** (каждый ns владеет своими ключами); проблемой становится только дубль в пределах одной семантики, который придётся синхронно править.

| # | Severity | Находка | file:line |
|---|---|---|---|
| D1 | optimization | validation.ts: «Введите название» 7×, «Тело — массив блоков» 4×, «Битый JSON» 3× — зеркально в en. | src/i18n/messages/ru/validation.ts:44,68,81,107,121,167,201 |
| D2 | optimization | validation.ts: invalidDate/invalidId-тексты дублируются попарно (lectures/trails, shareLinks/audit). | ru/validation.ts:72,115,150,189 |
| D3 | minor | errors.ts: 4 ключа block-id с идентичным текстом «Ошибка идентификаторов блоков…» (нужны 4 ключа для type-safe маппинга — добавить комментарий = одна строка). | ru/errors.ts:34-35,71-72 |
| D4 | minor | errors.ts: PARENT_NOT_AVAILABLE и PARENT_WRONG_LECTURE — идентичный текст (намеренно скрывает причину; усилить комментарий). | ru/errors.ts:26-27 |
| D5 | minor | canvas.ts: 3× toastErrorTitle = «Ошибка» дублируют errors.failureTitle; canvas-delete-button уже использует tErrors(\"failureTitle\"). Два подхода в одном слайсе. | ru/canvas.ts:15,24,42 |
| D6 | minor | annotations.editorLoading и comments.editorLoading — идентичный «Загрузка редактора…» в двух ns; кандидат на common.editor.loading. | ru/annotations.ts:31 |
| D7 | minor | makeBlocksJsonSchema локально определён 3× (comments/annotations/documents) с одинаковой структурой; banners/events/glossary вызывают blocksJsonField inline. Гетерогенность стиля. | src/features/comments/schemas.ts:13 |

> Отклонены как ложные DRY-срабатывания (намеренные семантические слои): canvas.validate.* vs validation.canvas.* (клиент vs server Zod, разные доступные ID + SERVER_ONLY-разделение); «Отмена» в 4 ns (common.confirmDialog.cancel привязан к UI-kit, нет плоского common.cancel); auth login/register passwordMax (разные .max(200)/.max(72)).

---

## Ось 3. Консистентность именования и структуры

| # | Severity | Находка | file:line |
|---|---|---|---|
| C1 | **important** | search.ts: api-ошибка `fetchFailed` плоская, нет обёртки api:{} вопреки всем 29 ns. | ru/search.ts:31 |
| C2 | minor | lectures.ts: api-ошибки плоские и суффикс Error вместо Failed (loadListError vs api.loadListFailed). | ru/lectures.ts:74-79 |
| C3 | minor | canvas.ts: action-ключ `forbiddenCreateAction` (инвертирован) vs `createForbiddenAction` в comments/annotations/trails. | ru/canvas.ts:190 |
| C4 | minor | canvas.ts: action-ключи вложены в sub-объекты (editForm.forbiddenUpdate) вместо flat root-уровня, как у остальных. | ru/canvas.ts:25,35,43,53 |
| C5 | minor | banners/events: btnCreate/btnSave/btnDelete; tags: create/save/delete; остальные: *Button. Три стиля для одного концепта. | ru/banners.ts:21-24 |
| C6 | minor | trails.ts: deleteLabel вместо deleteButton. | ru/trails.ts:23 |
| C7 | minor | glossary.totalCount={count} vs admin.totalCount={total} — одинаковый ключ, разные параметры; admin.totalCount мёртвый (нет callers). | ru/glossary.ts:38 |
| C8 | minor | comments.searchFoundCount={count} vs search.foundCount={total} — один UX-паттерн, разные ICU-переменные. | ru/comments.ts:30 |
| C9 | minor | settings: «English» захардкожен в locale-settings.tsx:19, нет ключа localeEn (localeRu/localeSystem есть). Эндоним — норма, но асимметрия каталога. | src/app/me/settings/locale-settings.tsx:19 |
| C10 | minor | audit.ts: metaTitle плоский vs admin.ts auditMetaTitle (оба существуют — проверить, который используется, удалить дубликат). | ru/audit.ts:20 |
| C11 | minor | forms.ts: уникальная Lower-конвенция (private/privateLower и т.д.) — нигде больше. | ru/forms.ts:18-19,24-25 |
| C12 | optimization | comments/trails: deleteForbiddenTitle и deleteFailureTitle = «Не удалось удалить» (идентичны, ложное ощущение различия). | ru/comments.ts:83-84 |
| C13 | optimization | statistics.viewCount «{count} просм.» — аббревиатура в обход plural. | ru/statistics.ts:26 |
| C14 | optimization | Только notifications.commentCreated использует ICU plural; «Всего записей: {total}», «Найдено: {count}» и т.д. без plural → «5 записей» vs «1 записей». | ru/notifications.ts:6 |

> Отклонены: casing errors.ts UPPER_SNAKE (зеркало Go apperror.Code) vs auth.ts lower_snake (frontend enum AuthError.kind) — разные концепты; forms.ts fieldType snake_case (зеркало backend enum, динамический lookup t(`fieldType.${type}`)); canvas toastXxxTitle (валидный локальный паттерн, другие тост-слайсы тоже разнобойны).

---

## Ось 4. Симметрия ru/en

Здоровая ось: 0 расхождений ключей, ICU-аргументов и plural-категорий; кириллицы в значениях en нет. Единственное:

| # | Severity | Находка | file:line |
|---|---|---|---|
| S1 | minor | Кириллица в файловых/секционных комментариях en-каталога («Зеркало ru/…», «// --- лекции ---»). На runtime не влияет, выглядит непоследовательно. | src/i18n/messages/en/errors.ts:2; en/admin.ts:6,40 |

---

## Ось 5. Баги и корректность

| # | Severity | Находка | file:line |
|---|---|---|---|
| B1 | **important** | **Даты комментариев всегда в ru-формате независимо от локали (online).** CommentNodeView вызывает `formatCommentDate(comment.created_at)` БЕЗ locale → дефолт DEFAULT_LOCALE='ru'. Online-контейнер CommentNode локализует deletedLabel/editedLabel/typeLabel через getT(\"comments\"), но locale даты не резолвит, и пропа для проброса нет. En-юзер видит «14.06.2026, 10:30» вместо «06/14/2026». comment-format.ts:2 прямо говорит, что ru — лишь офлайн-fallback → незавершённая проводка, не trade-off. | src/features/comments/ui/comment-node-view.tsx:69 |
| B2 | minor | Admin comment list — тот же root cause, без офлайн-оправдания (admin online-only). | src/features/comments/ui/admin-comment-row.tsx:20 |
| B3 | minor | Офлайн comment-tree: ru-лейблы/даты без проброса локали. Это документированный изоморфный hook-free контракт (ru fallback) → trade-off, но для en визуально неверно. Снапшот мог бы нести resolved locale хотя бы для дат. | src/features/comments/ui/comment-tree-view.tsx:22 |
| B4 | minor | messages.test.ts гарантирует key-parity, но НЕ ICU-плейсхолдер-паритет: дроп {count}/{action} или опечатка {nam} в одной локали пройдёт тест и сломается в рантайме. | src/i18n/messages/messages.test.ts:17-21 |

> Отклонены: `persistLocale ... as never` (санкционированная конвенция проекта для gap схемы; shorthand `{ locale }` делает опечатку ключа практически невозможной; пустой catch — намеренный best-effort, локаль уже в cookie); saved-lecture-view i18n-мок без useLocale (компонент не вызывает useLocale; CommentTreeView/CommentNodeView явно изоморфны без хуков; дата идёт через formatCommentDate со своим ru-дефолтом, мимо мокнутого useFmt — параметризация на 'en' этот путь не покрыла бы).

---

## Индустриальные практики и оптимизации (применимость)

### Внедрить (высокий payoff)

1. **precompile: true (next-intl 4.8+)** — *low effort, high payoff.* Мы на ^4.13, флаг доступен, в next.config.ts отсутствует. −9KB compressed, ICU-парсер → build-AST (дерискует своп). Используем только {var}/{count,plural} (оба поддержаны), НЕ используем t.raw — единственный trade-off бесплатен. Foundation-PR (next.config). Прямо адресует «осознанную ICU-привязку» из плейбука.

2. **Рантайм-тест ICU-паритета плейсхолдеров + plural-категорий** — *low effort, high payoff.* Закрывает находку B4 — самый конкретный пробел покрытия. Off-the-shelf i18n-check НЕ подходит (ест JSON/YAML, у нас TS-as-source). Маленький Vitest: regex-извлечь {placeholders}/plural-категории по ключу, ассертить симметрию (ru: one/few/many/other; en: ≥ one/other; наборы плейсхолдеров идентичны). В стиле server-only-namespaces.test.ts, без новых зависимостей.

3. **Сужение фасада до (key, params) => string** — *low effort, medium payoff.* Закрывает A1 + A2 одним движением: убирает доступность .rich/.markup/select и типовую утечку, делает «своп = один модуль» машинной правдой. Индустрия: facade оправдан именно для surface-restriction; не нужно БОЛЬШЕ абстракции — нужно закрыть единственную задокументированную дыру.

### Внедрить выборочно (средний payoff)

4. **Pseudo-localization dev/CI-локаль** — *medium effort, medium payoff.* Сильный фит для ru-default приложения: пропущенные строки остаются русскими и «выглядят норм» для ru-ревьюера. Псевдо-локаль ([Àççôûñţ]) делает un-extracted строки визуально очевидными за один dev-проход; доп. смоук кириллица-fallback (релевантно недавнему cyrillic-fallback-guard коммиту). Генерация маппингом по ru за фасадом, dev-only.

5. **eslint-plugin-i18next no-literal-string** — *medium effort, medium payoff.* Линтера на хардкод-строки нет; «очередь слайсов» extraction'а ведётся вручную, регрессия литералов — активный footgun (см. C9 «English»). Нужна настройка callees под наши useT/getT, режим jsx-text-only, ratchet (warn на старом, error на новом). Дополняет Guardrail 5 (тот ловит только импорты).

6. **MT review workflow + glossary для en-вычитки** — *medium effort.* En-каталог машинный, помечен «требует вычитки», процесса QA нет. Лёгкий per-string review-маркер + доменный глоссарий (lecture, glossary, trail, annotation, document) + in-context LQA через псевдо-локаль плумбинг.

### Оверкилл / не сейчас (высокое усилие)

7. **Per-route / scoped client provider** — *high effort.* Официальная рекомендация next-intl №1 по бандлу (мы делаем ровно то, от чего docs предостерегают: один глобальный I18nProvider с полным каталогом). НО 142 useT callsites → реалистично это per-segment allowlist, большой рефакторинг. Наш SERVER_ONLY_NAMESPACES — правильный примитив для расширения, но это отдельная инициатива, а не часть текущего ревью. Частичный дешёвый выигрыш: добавить тяжёлые server-side ns (admin, audit, statistics, glossary) в route-aware exclusion для не-admin страниц.

8. **Server-component-first label-passing (убрать useT)** — *high effort, medium payoff.* Enabling-рефактор для №7; механический, но per-slice. Наш изоморфный контракт уже задаёт паттерн (makeEntityRefResolver, formatCommentDate). Отложить до решения по №7.

---

## Рекомендации (приоритизированные)

**Сделать сейчас (low effort, реальный эффект):**
1. [B1/B2] Проп locale/dateLabel в CommentNodeView + резолв через getLocale()/getServerFmt() в CommentNode и AdminCommentRow. Единственный баг с пользовательским эффектом.
2. [техника 2 / B4] Рантайм-тест ICU-паритета плейсхолдеров и plural-категорий.
3. [техника 1] precompile: true в next-intl plugin (отдельный foundation-PR + прогон lint/test/build).
4. [C1] search.ts → api:{ fetchFailed }; [C2] lectures.ts → api:{...Failed} + обновить callers.

**Среднесрочно:**
5. [A1/A2 / техника 3] Сузить фасад переводчика до (key,params)=>string + собственный generic-тип ключей.
6. [D1/D2] validation.common для дублирующихся titleRequired/blocks*/invalidDate.
7. Выровнять именные расхождения партией при следующем касании слайсов: [C3] forbiddenCreate→createForbidden, [C4] canvas flat action-ключи, [C5] btn*→*Button, [C6] deleteLabel→deleteButton, [C7] удалить мёртвый admin.totalCount, [C8] {count}/{total} выравнивание.
8. [A5] Разнести errors на client-branded (forbidden*/accountRestricted) и server-only apiErrors, добавив apiErrors в SERVER_ONLY_NAMESPACES.

**Документация (закрыть честность плейбука):**
9. Дополнить docs/frontend-i18n.md §«Реальная цена свопа»: типовая утечка NamespaceT/ErrorsT + AppConfig augmentation (key-safety) переезжают на собственный generic при свопе.
10. [S1] Решить: перевести en-комментарии на английский ИЛИ зафиксировать кириллицу служебных заметок как норму в AGENTS.md.

**Опционально (если возьмётесь за бандл-инициативу):** псевдо-локаль (4), eslint no-literal-string (5), и затем большой рефактор scoped-provider (7) + server-first labels (8).

---

## Что проверено и НЕ является проблемой (кратко)

- Полный паритет ключей (28+ ns, 0 расхождений), ICU-аргументов и plural-категорий — система здорова по оси symmetry.
- getStoredLocale корректно вызывается на сервере и прокидывается пропом (не утечка server-only в client).
- ErrorsT/NamespaceT «дрейф» структурно невозможен (оба автовыводимы из одного Translator-shape).
- canvas.validate.* vs validation.canvas.* — намеренные слои (клиент/сервер, SERVER_ONLY).
- auth lower_snake vs errors UPPER_SNAKE, forms fieldType snake_case — намеренные backend-enum-зеркала.
- persistLocale `as never` + пустой catch — санкционированный best-effort паттерн.
- saved-lecture-view частичный i18n-мок — соответствует реально потребляемой поверхности (useT+useFmt).
