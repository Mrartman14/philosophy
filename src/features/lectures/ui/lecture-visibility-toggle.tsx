"use client";
import { useActionState, useEffect, useRef, useState } from "react";

import { Form, FormFeedback, Label, Select, Stack } from "@/components/ui";
import { useT } from "@/i18n/client";
import { initialActionState } from "@/utils/action-state";

import { setLectureVisibility } from "../actions";
import type { Lecture } from "../types";

const initial = initialActionState<Lecture | null>(null);

export function LectureVisibilityToggle({
  lecture,
}: {
  lecture: Pick<Lecture, "id" | "visibility">;
}) {
  const tL = useT("lectures");

  // Браузер сохраняет выбранный пользователем option в DOM до перезагрузки.
  // Сервер revalidate'ит lectures-кеш в action — на следующей навигации
  // server-component получит свежие данные.
  const [state, action] = useActionState(setLectureVisibility, initial);

  // Контролируемый Select + авто-сабмит формы. kit-Select даёт onValueChange(value)
  // БЕЗ DOM-события, поэтому форму сабмитим из useEffect ПОСЛЕ коммита значения
  // (скрытый input Select уже обновлён) — это исключает гонку.
  const [visibility, setVisibility] = useState(lecture.visibility);
  const formRef = useRef<HTMLFormElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return; // пропустить initial mount
    }
    formRef.current?.requestSubmit();
  }, [visibility]);

  return (
    <Form ref={formRef} action={action}>
      <Stack>
        <Label htmlFor="lecture-visibility">{tL("visibilityLabel")}</Label>
        <input type="hidden" name="id" value={lecture.id} />
        <Select
          name="visibility"
          aria-label={tL("visibilityLabel")}
          value={visibility}
          onValueChange={(v) => { setVisibility(v as Lecture["visibility"]); }}
          options={[
            { value: "private", label: tL("visibilityPrivate") },
            { value: "public", label: tL("visibilityPublic") },
          ]}
        />
        <FormFeedback result={state} forbiddenAction={tL("visibilityForbiddenAction")} />
      </Stack>
    </Form>
  );
}
