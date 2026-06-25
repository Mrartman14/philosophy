import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// useT("lectures") → реальный ru-каталог (как в соседних обёртках)
vi.mock("@/i18n/client", async () => {
  const lectures = (await import("@/i18n/messages/ru/lectures")).default;
  const useT = () => (key: string) =>
    (key.split(".").reduce<unknown>(
      (acc, k) => (acc as Record<string, unknown> | undefined)?.[k],
      lectures,
    ) ?? key) as string;
  return { useT };
});

import { LectureDocumentTabs } from "./lecture-document-tabs";

afterEach(cleanup);

const DOCS = [
  { id: "d1", label: "Первый" },
  { id: "d2", label: "Второй" },
];

describe("LectureDocumentTabs", () => {
  it("показывает основной документ и не грузит остальные на старте", () => {
    const loadBlocks = vi.fn();
    render(
      <LectureDocumentTabs
        docs={DOCS}
        primaryId="d1"
        primaryPanel={<div>ОСНОВНОЙ</div>}
        loadBlocks={loadBlocks}
      />,
    );
    expect(screen.getByText("ОСНОВНОЙ")).toBeInTheDocument();
    expect(loadBlocks).not.toHaveBeenCalled();
    // ленивая панель d2 не смонтирована (keepMounted=false) — её состояний нет в DOM
    expect(screen.queryByText("Загрузка документа…")).not.toBeInTheDocument();
  });

  it("лениво грузит тело второй вкладки и кэширует (без повторного запроса)", async () => {
    const loadBlocks = vi.fn().mockResolvedValue({
      success: true,
      data: [{ id: "p1", type: "paragraph", content: [{ type: "text", text: "ВТОРОЙ-ТЕЛО" }] }],
    });
    render(
      <LectureDocumentTabs
        docs={DOCS}
        primaryId="d1"
        primaryPanel={<div>ОСНОВНОЙ</div>}
        loadBlocks={loadBlocks}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Второй" }));
    expect(await screen.findByText("ВТОРОЙ-ТЕЛО")).toBeInTheDocument();
    expect(loadBlocks).toHaveBeenCalledTimes(1);

    // назад на первую, затем снова на вторую — запрос не повторяется (кэш в родителе)
    fireEvent.click(screen.getByRole("tab", { name: "Первый" }));
    fireEvent.click(screen.getByRole("tab", { name: "Второй" }));
    expect(await screen.findByText("ВТОРОЙ-ТЕЛО")).toBeInTheDocument();
    expect(loadBlocks).toHaveBeenCalledTimes(1);
  });

  it("ошибка загрузки → docTabError; результат не кэшируется (повторная активация грузит снова)", async () => {
    const loadBlocks = vi.fn().mockResolvedValue({ success: false, error: "boom" });
    render(
      <LectureDocumentTabs
        docs={DOCS}
        primaryId="d1"
        primaryPanel={<div>ОСНОВНОЙ</div>}
        loadBlocks={loadBlocks}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Второй" }));
    expect(
      await screen.findByText("Не удалось загрузить документ."),
    ).toBeInTheDocument();
    expect(loadBlocks).toHaveBeenCalledTimes(1);

    // ошибка НЕ кэшируется (onLoaded не звался) — возврат и повторная активация грузят снова
    fireEvent.click(screen.getByRole("tab", { name: "Первый" }));
    fireEvent.click(screen.getByRole("tab", { name: "Второй" }));
    await waitFor(() => {
      expect(loadBlocks).toHaveBeenCalledTimes(2);
    });
  });
});
