"use client";

import Link from "next/link";
import { useMemo } from "react";
import groupBy from "lodash/groupBy";
import { usePathname } from "next/navigation";

import { structure } from "@/utils/structure";
import { Mention } from "@/components/shared/mention";

export const AppNav: React.FC = () => {
  const pathname = usePathname();
  const groupedByChapter = useMemo(
    () => groupBy(structure, (x) => x.section),
    []
  );
  return (
    <ul className="grid grid-cols-1 gap-2 w-[90vw] md:w-[500px] max-h-[80vh] overflow-y-scroll">
      {Object.entries(groupedByChapter).map(([chapter, data]) => {
        return (
          <div key={chapter} className="static w-full grid grid-cols-1">
            <h6
              className={`sticky top-0 text-(--description) bg-(--background) text-lg p-2 border-b-1 border-b-(--border) rounded text-right`}
            >
              {chapter}
            </h6>
            {data.map((item) => {
              const href = `/lectures/${item.slug}`;
              const isActive = pathname === href;
              const lClasses = `${
                isActive ? "text-(--primary)" : ""
              } group block p-2 hover:bg-(--text-pane) font-semibold focus:outline-0`;

              return (
                <li key={href}>
                  <Link href={href} className={lClasses}>
                    <span className="group-hover:underline group-focus:underline">
                      {item.order}. {item.title}
                    </span>
                    <div className="flex gap-1 items-center flex-wrap">
                      {item.mentions.map((m, i, arr) => (
                        <div key={m} className="flex items-center text-xs">
                          <Mention className="text-xs" name={m} />
                          <span>{i < arr.length - 1 && ","}</span>
                        </div>
                      ))}
                    </div>
                  </Link>
                </li>
              );
            })}
          </div>
        );
      })}
    </ul>
  );
};
