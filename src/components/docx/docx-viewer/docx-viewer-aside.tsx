"use client";

import { useState, useEffect } from "react";

import {
  AsideMenu,
  AsideNavItem,
} from "@/components/shared/aside-menu/aside-menu";
import { ParsedData, ParsedHeadingData } from "@/utils/parse-docx";

export const DocxViewerAside: React.FC<{ parsedData: ParsedData }> = ({
  parsedData,
}) => {
  const [asideItems, setAsideItems] = useState<AsideNavItem[]>([]);

  useEffect(() => {
    function mapper(h: ParsedHeadingData) {
      const item: AsideNavItem = {
        id: h.id,
        render: ({ isSelected }) => (
          <span
            className={`flex py-1 ${isSelected ? "" : "text-(--description)"}`}
          >
            {h.text}
          </span>
        ),
        children: h.children?.map(mapper) ?? [],
      };

      return item;
    }

    const nextAsideItems: AsideNavItem[] = parsedData.headingsData.map(mapper);

    setAsideItems(nextAsideItems);
  }, [parsedData.headingsData]);

  return <AsideMenu items={asideItems} className={`hidden md:grid`} />;
};
