# Дизайн: stateful entity-agnostic кнопка офлайн-сохранения

Дата: 2026-06-20

## Проблема

Кнопка `SaveOfflineButton` ([src/app/_offline/save-offline-button.tsx](../../../src/app/_offline/save-offline-button.tsx))
не отражает реальное состояние офлайн-копии. Её `saved`-стейт инициализируется в
`false` на каждой загрузке и становится `true` только после клика в текущей сессии.
Следствия:

- Вернувшийся пользователь видит «Сохранить офлайн», даже если копия уже на устройстве,
  — со страницы лекции нельзя понять, что копия есть.
- Сигнала «доступно обновление» на странице лекции нет вообще. Узнать, что лекция
  изменилась, можно только зайдя в `/saved` будучи онлайн.
- Нет способа удалить сохранённую копию со страницы лекции.

Многоверсионности при этом **нет** (ключ хранилища `entity:id`, перезапись на месте) —
это не баг данных, а UX-разрыв.

## Цель

Кнопка на странице лекции отражает реальное состояние копии и позволяет ею управлять:
сохранить / увидеть «сохранено» / увидеть «доступно обновление» и обновить / удалить
копию. Кнопка остаётся **entity-agnostic** — без единого упоминания «lectures».

## Ключевые решения (зафиксированы в брейншторме)

1. **Объём — полное управление**: состояния `not-saved` / `saved-fresh` /
   `saved-stale` + действие «Удалить копию». Состояние `gone` на странице лекции
   не обрабатываем (см. §«Краевые случаи»).
2. **Свежесть — один источник истины**: переиспользуем оркестрацию ревалидации
   (manifest-проба по `freshnessToken`/ETag с fallback на `updated_at`), а **не**
   считаем свежесть отдельно по «отображательному» `updated_at`. Это убирает риск
   двух расходящихся определений «устарело» между страницей лекции и `/saved`.
3. **Entity-agnostic сейчас**: обобщаем путь свежести в шов дескриптора немедленно,
   чтобы кнопка была полностью сущность-независимой; будущий `documents` подключается
   добавлением своей capability в дескриптор, без переделок кнопки.

Из (2) следует, что свежесть считает сама `revalidateSavedBundle` своей пробой —
**проп с серверным `updated_at` со страницы не нужен**. Пропы кнопки остаются
`{ entity, id }`, страница лекции ([src/app/lectures/[id]/page.tsx](../../../src/app/lectures/[id]/page.tsx))
**не меняется**.

## Состояния (state machine)

Компонент клиентский (IndexedDB читается только на клиенте).

| Состояние | UI | Действия |
|---|---|---|
| `unknown` | нейтральная кнопка `disabled` (до первого чтения IDB) | — |
| `not-saved` | «Сохранить офлайн» | → save |
| `saving` | «Сохранение…» (disabled) | — |
| `saved-fresh` | «Сохранено офлайн ✓» + «Удалить копию» | → delete |
| `saved-stale` | «Доступно обновление» + «Обновить» + «Удалить копию» | → re-save / delete |
| `updating` | «Обновление…» (disabled) | — |
| `removing` | «Удаление…» (disabled) | — |

Переходы:

- `unknown → not-saved | saved-fresh` после чтения `getSavedBundle(entity, id)`.
- `saved-fresh → saved-stale` после ревалидации, если `remoteStatus === "stale"`.
- `not-saved → saving → saved-fresh` (или toast-ошибка, возврат в `not-saved`).
- `saved-stale → updating → saved-fresh` (re-save через `saveOffline`).
- `saved-* → removing → not-saved` (после confirm).

## Поведение на маунте

1. `getSavedBundle(entity, id)`: нет записи → `not-saved`; есть → `saved-fresh`.
2. Если `navigator.onLine === true` → `revalidateSavedBundle(entity, id)`, затем
   перечитать `remoteStatus`; `stale` → `saved-stale`. Оффлайн — ревалидацию
   пропускаем (best-effort, как в `/saved`), показываем последний известный статус.

## Архитектура: обобщение свежести

Сейчас логика свежести захардкожена под лекцию в
[src/app/_offline/revalidate-saved-lecture.ts](../../../src/app/_offline/revalidate-saved-lecture.ts)
и [src/app/_offline/probe-lecture-manifest-action.ts](../../../src/app/_offline/probe-lecture-manifest-action.ts).
Обобщаем по штатному шву — дескриптору ([src/services/offline/contract/descriptor.ts](../../../src/services/offline/contract/descriptor.ts)).

### Дескриптор владеет «как понять, что МОЯ копия устарела»

В `OfflineDescriptor` добавляется опциональная capability:

```ts
freshness?: {
  /** server-only: условная manifest-проба (ETag/version). */
  probeManifest: (id: string, token?: string) => Promise<ProbeResult>;
  /** legacy-fallback: текущий маркер свежести с сервера. */
  fetchUpdatedAt: (id: string) => Promise<string | null>;
  /** достать маркер свежести из СВОЕГО снимка (форма снимка известна дескриптору). */
  snapshotUpdatedAt: (snapshot: TSnapshot) => string | null;
};
```

`ProbeResult` — существующий union из
[probe-lecture-manifest-action.ts](../../../src/app/_offline/probe-lecture-manifest-action.ts)
(`fresh | stale(freshnessToken) | gone | skip`), вынесенный в общий тип.

Если у дескриптора нет `freshness` — ревалидация становится no-op, кнопка работает в
режиме `saved`/`not-saved`.

### Ядро: `revalidateSavedBundle(entity, id)` (client)

Бывший `revalidateSavedLecture` минус знание о лекции. Оркестрация:

1. Прочитать запись `getSavedBundle(entity, id)`; нет записи или нет `descriptor.freshness` → `skip`.
2. Есть `freshnessToken` → `descriptor.freshness.probeManifest(id, token)` через generic
   server-action (см. ниже).
3. Иначе legacy-путь: `fetchUpdatedAt(id)` vs `snapshotUpdatedAt(record.snapshot)`.
4. CAS-гард (перечитать запись, убедиться, что `snapshotUpdatedAt` не изменился за
   время пробы) — остаётся в ядре, generic.
5. Записать `remoteStatus` (`stale`/`gone`) и при свежести — обновить `freshnessToken`.

### Generic server-action `probeManifestAction(entity, id, token?)`

`probeManifest` — `server-only` (дескрипторы тянут server-only фетчеры), а клиент не может
импортировать server-only дескрипторы напрямую. Поэтому одна generic server-action
резолвит дескриптор на сервере (`resolveDescriptor(entity)`) и вызывает его
`freshness.probeManifest`. Это ровно тот же клиент/сервер-сплит, что уже работает в
паре `revalidate-saved-lecture` (client) ↔ `probe-lecture-manifest-action` (server-action).

### `lectureDescriptor.freshness`

Переносим текущую lecture-логику пробы/legacy/`snapshotUpdatedAt` в
`lectureDescriptor.freshness` ([src/app/_offline/descriptors/lecture-descriptor.ts](../../../src/app/_offline/descriptors/lecture-descriptor.ts)).
`snapshotUpdatedAt` читает `snapshot.lecture.updated_at` (форма `LectureSnapshot`).

## Миграция `/saved`

`saved-lecture-view` переводится с `revalidateSavedLecture(id)` на
`revalidateSavedBundle("lectures", id)`. Старые `revalidateSavedLecture` и
`probeLectureManifest` удаляются (не оставляем дубль — единый источник истины).
Текст «Доступна обновлённая версия — нажмите „Обновить“» и кнопка «Обновить» в `/saved`
остаются как есть, работают поверх обобщённой функции.

## Удаление копии

`deleteSavedBundle(entity, id)` уже существует
([src/services/offline/store/saved-bundles.ts](../../../src/services/offline/store/saved-bundles.ts)),
entity-agnostic — foundation не трогаем для удаления.

UX: **лёгкий confirm-диалог** перед удалением (удаление обратимо только онлайн —
повторным сохранением). По подтверждению → `removing` → `deleteSavedBundle` →
`not-saved` + toast «Копия удалена».

## Краевые случаи

- **`gone` на странице лекции не обрабатываем**: если лекция удалена,
  `getLectureById(id)` вернёт `null` → `notFound()`, и кнопка не отрендерится (404).
  Если редкая гонка (удаление между fetch страницы и маунтом кнопки) даст `gone` от
  пробы — трактуем как `saved-fresh` (копия цела), без отдельного UI. В `/saved`
  `gone` обрабатывается отдельно и остаётся как есть.
- **Оффлайн на маунте**: ревалидацию пропускаем, показываем последний известный
  `remoteStatus` из записи.
- **Сетевые сбои пробы**: best-effort, кнопка остаётся в `saved-fresh`, ложным
  сигналом не мусорим.
- **Гидратация**: первый рендер — `unknown` (disabled), без прыжка к ложному
  состоянию до чтения IDB.
- **Известная погрешность `updated_at`-fallback**: если бэк меняет вложение
  (медиа/картинку) без бампа `updated_at`, legacy-путь это не поймает. Эту же
  погрешность уже принимает текущая ревалидация; manifest-путь (когда есть
  `freshnessToken`) её закрывает.

## i18n

Новые ключи в namespace `pages` (ru/en):

- `saveOfflineUpdateAvailable` — «Доступно обновление»
- `saveOfflineUpdate` — «Обновить»
- `saveOfflineUpdating` — «Обновление…»
- `saveOfflineRemove` — «Удалить копию»
- `saveOfflineRemoving` — «Удаление…»
- `saveOfflineRemoveConfirmTitle` / `saveOfflineRemoveConfirmBody` / `saveOfflineRemoveConfirmAction`
- `saveOfflineRemovedToast` — «Копия удалена»

Существующие save-ключи (`saveOfflineButton`, `saveOfflineSaving`,
`savedLectureSavedBadge`, `saveOfflineSuccessTitle`, `saveOfflineFailTitle`)
переиспользуются. `savedLectureSavedBadge` (lecture-специфичное имя) допустимо
оставить или переименовать в нейтральное при реализации — не блокер.

## Тестирование

- `save-offline-button.test.tsx` — расширить: все состояния; `unknown → hydrated`;
  ветка `stale → Обновить`; delete с confirm; оффлайн-скип ревалидации; toast-ошибки.
- `revalidate-saved-bundle.test.ts` — перенести/обобщить кейсы из
  `revalidate-saved-lecture.test.ts` (304→fresh, 200→stale+token, 404→gone,
  manifest-skip→legacy, CAS-гонка) на entity-параметр.
- `/saved` тесты (`saved-lecture-view.test.tsx`) — обновить на `revalidateSavedBundle`.

## Границы и зоны

- **Foundation-touch (осознанно)**: контракт `OfflineDescriptor`
  (`src/services/offline/contract/descriptor.ts`) — добавление опциональной
  `freshness`. По AGENTS.md это foundation-update; делаем в рамках этой же работы.
- **Редактируемый композиционный корень**: `src/app/_offline/*` — кнопка, ядро
  ревалидации, generic probe-action, lecture-дескриптор.
- **Не трогаем**: `src/app/lectures/[id]/page.tsx`, примитивы хранилища
  (`saved-bundles.ts` уже всё предоставляет), UI-kit.

## Вне объёма (YAGNI)

- Офлайн-сохранение документов/других сущностей (только подготавливаем шов).
- Кастомный not-found на странице удалённой лекции со ссылкой на сохранённую копию.
- Индикатор устаревания в списке `/saved` (там сейчас только на странице копии).
