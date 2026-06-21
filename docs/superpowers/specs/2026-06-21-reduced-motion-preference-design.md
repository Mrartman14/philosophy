# Reduced Motion — пятая ось appearance

Дата: 2026-06-21
Статус: design (одобрен пользователем, ждёт ревью спеки)
Тип: **foundation-update** (расширение appearance-фундамента), не фича-слайс.

## 1. Задача и контекст

Пользователь хочет настройку «уменьшить движение» в user preferences. Бэкенд уже
реализован: контракт `preference.Motion = "system" | "reduced" | "full"`, поле
`motion?` присутствует в read- и write-формах appearance
(`src/api/schema.ts`, `preference.Appearance` / `preference.AppearancePatch`).
FE-схема уже перегенерирована (в рабочем дереве).

Два инсайта, определившие дизайн:

1. **Это в первую очередь системная (OS) настройка.** Браузер отдаёт её через
   `prefers-reduced-motion`. В проекте уже есть один блок, уважающий media-запрос
   (`src/app/globals.css`, шиммер router-link). Поэтому новая ось — это
   расширение существующего паттерна «следовать ОС / явный override», а не
   изолированный тумблер. Бэк выбрал значение `system` (как `theme:system`,
   `locale:system`), а не omit-трюк контраста — моделируем 1:1, без трансляции.

2. **Карта смыслов почти не движется «сама по себе».** Аудит рендерера
   (`src/features/semantic-map/renderer/three-map-renderer.ts`) показал: нет
   `autoRotate`, нет idle-дрейфа, нет анимированного «полёта» камеры к узлу
   (`fitToBounds` мгновенный), render-loop — по dirty-флагу (рисует только после
   действия пользователя). Единственное автоматическое движение — инерция
   `OrbitControls.enableDamping = true` (камера «доезжает» после отпускания мыши).

Из (2) следует: ложная дихотомия «весь сайт статичен vs карту трогать нельзя» не
нужна. Reduced motion — про движение **без** действия пользователя или поверх
него; перетаскивание/зум карты — прямая манипуляция (как скролл), её не глушим.

## 2. Принятые решения

- **Политика — нюансная** (не blunt). Глушим движение/трансформы/инерцию и
  бесконечные (looping) анимации; одноразовый opacity-fade и hover-смену цвета
  оставляем. Стержневое правило: **движение/transform/looping → off; одноразовый
  opacity-fade и hover-цвет → ok.**
- **Значения оси — `system | reduced | full`** (из бэка, 3 значения).
  - `system` — следовать ОС (`prefers-reduced-motion`). DEFAULT.
  - `reduced` — форсить уменьшение независимо от ОС.
  - `full` — форсить анимации даже если ОС просит reduce (явный override
    media-запроса, симметрично тому, как `[data-contrast]` перебивает
    `prefers-contrast`).
- **Семантика `system` = follow OS** — предположение к подтверждению у бэка
  (см. §8). От неё зависит дефолт; имя и аналогия с `theme:system` её
  подтверждают.

## 3. Резолюция «когда уменьшать» (ядро)

Движение уменьшается, если:

```
data-motion == "reduced"
  ИЛИ
(prefers-reduced-motion: reduce  И  data-motion != "full")
```

`data-motion` эмитится на `<html>` только когда значение ≠ `system` (как у
`theme`/`contrast`): `system` → атрибута нет → правит media-запрос; `reduced` /
`full` → атрибут выставлен.

### CSS-паттерн (два зеркальных условия)

Каждое reduced-правило применяется под двумя селекторами:

```css
/* (A) явный override пользователя — независимо от ОС */
[data-motion="reduced"] <target> { /* reduced declarations */ }

/* (B) ОС просит reduce и пользователь НЕ форснул full */
@media (prefers-reduced-motion: reduce) {
  :root:not([data-motion="full"]) <target> { /* reduced declarations */ }
}
```

Существующий блок router-link (`globals.css:87-92`) переписывается в этот паттерн.
Декларации дублируются между (A) и (B) — это осознанный trade-off ради
SSR-no-FOUC (CSS не может схлопнуть OS-условие в один атрибут на сервере).

### JS-резолюция (для карты)

Та же формула в JS через хук (см. §6): для `system` читаем
`matchMedia("(prefers-reduced-motion: reduce)")`, для `reduced`/`full` —
значение оси из `useAppearance()`.

## 4. Изменения в трубе appearance (file-by-file)

Вся существующая труба переиспользуется; новая ось встаёт по образцу `theme`.

| Файл | Изменение |
|---|---|
| `src/styles/tokens/enums.ts` | `export const MOTIONS = ["system","reduced","full"] as const;` + `type Motion`. |
| `src/components/appearance/appearance-cookie.ts` | `Appearance.motion: Motion`; `DEFAULT_APPEARANCE.motion = "system"`; `ENUMS.motion = MOTIONS`; `parseAppearance` → `motion: pick("motion", o.motion)`; `htmlAttrs` → `...(a.motion !== "system" ? { "data-motion": a.motion } : {})`. |
| `src/components/appearance/appearance-provider.tsx` | добавить `"data-motion"` в `DATA_KEYS` (чтобы `applyToHtml` ставил/снимал атрибут вживую). `setAxis` уже generic — без правок логики. |
| `src/components/appearance/persist-appearance.ts` | `toAppearancePayload` → `motion: a.motion` (напрямую, без omit; как `theme`). |
| `src/utils/appearance.ts` | `fromBackend` → `motion: a?.motion ?? "system"`. |
| `src/app/me/settings/appearance/appearance-settings.tsx` | новый `MOTION` options-массив + `<Row><Select .../></Row>`, по образцу `theme`. |

Примечание: серверной Zod-валидации appearance на PATCH нет — значения
валидируются клиентом в `parseAppearance` (`ENUMS`/`pick`) и типами
`preference.AppearancePatch`. Дополнительная Zod-схема не требуется.

## 5. Инвентарь движения и трактовка (нюансная политика)

| Источник | Файл | Трактовка под reduce |
|---|---|---|
| Инерция камеры (OrbitControls damping) | `three-map-renderer.ts:89` | **off** через JS-мост (§6). Навигацию drag/zoom НЕ трогаем. |
| router-link shimmer (looping) | `globals.css:73-92` | `animation: none` (уже есть; переехать в новый gate-паттерн с `:not([data-motion="full"])` + ветку `[data-motion="reduced"]`). |
| skeleton `animate-pulse` (looping) | `src/components/ui/skeleton.tsx` | `animation: none` под reduce (looping глушим даже на opacity). Правило в globals.css на `.animate-pulse`. |
| NavMenu popup `scale-90` + позиционные `transition-[top,left,…]` | `src/components/app/app-header/app-header.tsx:97-103` | убрать transform/scale/позиционный transition; opacity-fade оставить (можно укоротить). |
| fancy-link стрелка `transition: left 200ms` (позиционный сдвиг) | `globals.css:42-56` | глушить движение стрелки (transition в 0 / без сдвига). |
| Dialog/popover opacity fade (одноразовый) | `src/components/ui/dialog.tsx` и пр. | **оставляем** (opacity не вестибулярен). При желании укоротить длительность. |
| Hover bg-color 150ms (кнопки/ссылки/карточки) | разное | **оставляем** (это не «движение»). |

Базовый принцип повторно: looping и transform/позиция → off; одноразовый
opacity + цвет → ok.

## 6. Мост к three.js (порт + хук)

Рендерер должен оставаться framework-agnostic (порт `MapRenderer`). React не
протекает в рендерер.

1. **Хук `useReducedMotion()`** в `src/components/appearance/` — единый источник
   JS-резолюции (DRY с CSS-правилом §3):
   - читает `appearance.motion` из `useAppearance()`;
   - подписывается на `matchMedia("(prefers-reduced-motion: reduce)")` (событие
     `change`) для случая `system`;
   - возвращает `boolean` (`reduce`).
   - экспортируется через `src/components/appearance/index.ts`.
2. **Порт** `src/features/semantic-map/renderer` (`MapRenderer`): новый метод
   `setReducedMotion(reduce: boolean): void`.
3. **ThreeMapRenderer**: хранит флаг `reducedMotion`; в `applyMode()`
   `this.controls.enableDamping = !this.reducedMotion;` + `setReducedMotion`
   выставляет флаг и, если контролы существуют, применяет немедленно
   (`controls.enableDamping = !reduce`) и `this.dirty = true`.
4. **`semantic-map-view.tsx`**: `const reduce = useReducedMotion();` — вызвать
   `r.setReducedMotion(reduce)` в lifecycle-эффекте (после `setMode`) и в
   отдельном эффекте `[reduce]` для рантайм-смены настройки.

`useAppearance`/`useReducedMotion` импортируются из общего провайдера
`@/components/appearance` (shared, не cross-feature импорт).

## 7. i18n

Appearance-настройки локализованы (`useT("settings")`). Добавить ключи в **обе**
локали (ru + en) за фасадом `@/i18n`:
`appearance.motionLabel`, `appearance.motionAriaLabel`,
`appearance.motion.system`, `appearance.motion.reduced`, `appearance.motion.full`.
Черновик копирайта (ru): «Анимация» / «Системно» / «Меньше движения» /
«Полная анимация» — финал утверждает пользователь.

## 8. Открытые вопросы / к подтверждению

- **Семантика `system` у бэка**: трактует ли бэк `motion:"system"` как «следовать
  ОС» (а не «всегда полная анимация»)? Дизайн исходит из «follow OS». Если иначе —
  скорректировать дефолт/маппинг.
- **Копирайт лейблов** (ru/en) — за пользователем.

## 9. Вне объёма (YAGNI)

- Не нюкаем все transitions глобально (отвергнутая blunt-политика).
- Не трогаем навигацию карты (drag/zoom/rotate) — это прямая манипуляция.
- Не добавляем анимации, которых нет (карта и так без autoRotate/idle/полёта).
- Не правим `tokens.generated.css` руками (это вывод генератора; reduced-motion
  правила пишем в `globals.css`).

## 10. Тестирование

- Unit: `htmlAttrs` (motion → emit при `reduced`/`full`, omit при `system`);
  `parseAppearance` (валидный/мусорный `motion` → fallback `system`);
  `toAppearancePayload` (passthrough `motion`); `fromBackend`
  (`motion` отсутствует → `system`).
- Unit: `useReducedMotion` — матрица `system/reduced/full` × OS on/off.
- Возможно компонентный тест Select в appearance-settings (наличие новой строки).
- CSS-поведение и damping в WebGL — ручная проверка (юнит непрактичен).
- Перед PR зелёные: `pnpm lint && pnpm test && pnpm build`.
