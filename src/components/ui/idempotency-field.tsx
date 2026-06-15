"use client";
// src/components/ui/idempotency-field.tsx
import { useState } from "react";

import type { ActionResult } from "@/utils/create-action";
import { IDEMPOTENCY_FIELD } from "@/utils/idempotency";

interface Props {
  /** Текущее значение из `useActionState` формы — триггер ротации после успеха. */
  result: ActionResult<unknown>;
}

/**
 * Скрытое поле с ключом идемпотентности для мутирующей формы.
 *
 * Политика ключа:
 * - стабилен на время жизни формы → защищает от двойного клика и повтора после
 *   потери ответа (тот же ключ → бэк реплеит, а не дублирует);
 * - ротируется ПОСЛЕ каждого успешного сабмита → следующая (уже другая)
 *   мутация получает свежий ключ, иначе словила бы 422 REUSED.
 *
 * Известный edge: success + потеря ответа + правка тела + повтор → 422 REUSED;
 * обрабатывается текстом в `rethrowApiError`. См. docs/frontend-conventions.md.
 *
 * Поместить ВНУТРЬ `<Form>` рядом с прочими hidden-полями.
 *
 * Ротация — паттерн «adjust state during render» (react.dev), НЕ useEffect:
 * правило `react-hooks/set-state-in-effect` (активно, error) запрещает setState
 * в эффектах. Сравнение текущего `result` с предыдущим ловит переход в success
 * без эффекта (как в `src/features/tags/ui/tag-admin-row.tsx`).
 */
export function IdempotencyField({ result }: Props) {
  const [key, setKey] = useState<string>(() => crypto.randomUUID());
  const [prevResult, setPrevResult] = useState(result);

  // На монтировании prevResult === result (та же ссылка) → ротации нет.
  // useActionState отдаёт новый объект на каждый сабмит → ловим переход в success.
  if (result !== prevResult) {
    setPrevResult(result);
    if (result.success) setKey(crypto.randomUUID());
  }

  return (
    <input type="hidden" name={IDEMPOTENCY_FIELD} value={key} readOnly />
  );
}
