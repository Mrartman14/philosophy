import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Table, Tbody, Td, Th, Thead, Tr } from "./table";

afterEach(cleanup);

describe("Table", () => {
  it("отдаёт <table> с каноническим классом ui-table (общий облик с .content)", () => {
    render(
      <Table>
        <Tbody>
          <Tr>
            <Td>c</Td>
          </Tr>
        </Tbody>
      </Table>,
    );
    expect(screen.getByRole("table")).toHaveClass("ui-table");
  });

  it("Th рендерит <th> и пробрасывает потребительский className", () => {
    render(
      <Table>
        <Thead>
          <Tr>
            <Th className="whitespace-nowrap">H</Th>
          </Tr>
        </Thead>
      </Table>,
    );
    const th = screen.getByRole("columnheader", { name: "H" });
    expect(th.tagName).toBe("TH");
    expect(th).toHaveClass("whitespace-nowrap");
  });

  it("Td рендерит <td> и пробрасывает потребительский className", () => {
    render(
      <Table>
        <Tbody>
          <Tr>
            <Td className="text-end">C</Td>
          </Tr>
        </Tbody>
      </Table>,
    );
    const td = screen.getByRole("cell", { name: "C" });
    expect(td.tagName).toBe("TD");
    expect(td).toHaveClass("text-end");
  });
});
