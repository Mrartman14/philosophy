"use client";
import { useCallback, useState } from "react";

/**
 * Клиентский ключ идемпотентности для ИМПЕРАТИВНЫХ мутаций (кнопки без формы,
 * напр. удаление). Ключ стабилен между ретраями одного намерения (двойной клик /
 * повтор после ошибки шлют тот же ключ → бэк реплеит, а не дублирует). Вызови
 * `rotate()` после успешного результата, чтобы следующее действие получило свежий
 * ключ. Передавай `key` вторым аргументом в экшен из `createAction`.
 */
export function useIdempotencyKey(): { key: string; rotate: () => void } {
  const [key, setKey] = useState<string>(() => crypto.randomUUID());
  const rotate = useCallback(() => {
    setKey(crypto.randomUUID());
  }, []);
  return { key, rotate };
}
