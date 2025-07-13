"use client";

import { useState, useEffect } from "react";

import { ParsedData } from "@/utils/parse-docx";
import { AsideNavItem, AsideMenu } from "@/components/shared/aside-menu";

export const DocxViewerAside: React.FC<{ parsedData: ParsedData }> = ({
  parsedData,
}) => {
  const [asideItems, setAsideItems] = useState<AsideNavItem[]>([]);

  useEffect(() => {
    const nextAsideItems: AsideNavItem[] = parsedData.headingsData.map((h) => {
      return {
        id: h.id,
        render: ({ isSelected }) => (
          <span
            className={`grid gap-4 grid-rows-1 ${
              isSelected ? "" : "text-(--description)"
            }`}
            style={{
              gridTemplateColumns: `repeat(${h.depth}, 1px) 1fr`,
            }}
          >
            {[...new Array(h.depth)].map((_, i) => (
              <div key={i} className="bg-(--border)" />
            ))}
            <span className="py-1">{h.text}</span>
          </span>
        ),
      };
    });

    setAsideItems(nextAsideItems);
  }, [parsedData.headingsData]);

  return <AsideMenu items={asideItems} className={`hidden md:grid`} />;
};
