import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// useT("pages"|"shareLinks") резолвится из реальных ru-каталогов без next-intl-провайдера.
vi.mock("@/i18n/client", async () =>
  (await import("@/test/i18n-client-mock")).i18nClientMock(),
);

// ShareDialog — контролируемый компонент с useRouter/useToast/useActionState;
// здесь проверяется только меню, поэтому подменяем его лёгкой заглушкой (как в
// `save-offline-button.test.tsx` для kit-зависимостей). Закрытый диалог UI не рендерит.
vi.mock("@/features/share-links", () => ({
  ShareDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="share-dialog" /> : null,
}));

import { LectureActionsMenu } from "./lecture-actions-menu";

afterEach(cleanup);

const URLS = { md: "/lectures/L1/export?format=md", txt: "/lectures/L1/export?format=txt" };

// Base UI Menu открывается по pointerdown→click; user-event в репо не установлен,
// поэтому триггерим обе фазы через fireEvent (рабочий паттерн из menu.test.tsx).
function openMenu() {
  const trigger = screen.getByRole("button", { name: "Действия" });
  fireEvent.pointerDown(trigger);
  fireEvent.click(trigger);
}

describe("LectureActionsMenu", () => {
  it("пункты .md/.txt со ссылками; «Поделиться» при share", async () => {
    render(<LectureActionsMenu exportUrls={URLS} share={{ resourceId: "L1", initialLinks: [] }} />);
    openMenu();
    expect(await screen.findByRole("menuitem", { name: "Скачать .md" })).toHaveAttribute("href", URLS.md);
    expect(screen.getByRole("menuitem", { name: "Скачать .txt" })).toHaveAttribute("href", URLS.txt);
    expect(screen.getByRole("menuitem", { name: "Поделиться" })).toBeInTheDocument();
  });

  it("без share — нет пункта «Поделиться»", async () => {
    render(<LectureActionsMenu exportUrls={URLS} share={null} />);
    openMenu();
    await screen.findByRole("menuitem", { name: "Скачать .md" });
    expect(screen.queryByRole("menuitem", { name: "Поделиться" })).not.toBeInTheDocument();
  });
});
