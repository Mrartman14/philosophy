"use client";

import { useState } from "react";
import { Tabs } from "@base-ui-components/react/tabs";

import { LessonPageData } from "@/entities/page-data";
import DocxViewer from "../docx/docx-viewer/docx-viewer";

interface LessonPageProps {
  data: LessonPageData;
}
export const LessonPage: React.FC<LessonPageProps> = ({ data }) => {
  const [selectedVersion, setSelectedVersion] = useState<string>(
    data.sources[0].name
  );

  const handleSetVersion = (value: string) => {
    setSelectedVersion(value);
  };

  const roundedClasses = `rounded-lg rounded-bl-[0px] rounded-br-[0px]`;

  return (
    <Tabs.Root
      value={selectedVersion}
      className={`w-full md:mt-[-40px]`}
      onValueChange={(x) => handleSetVersion(x)}
    >
      <nav className="w-full grid grid-cols-1 overflow-x-auto">
        <Tabs.List
          render={
            <ul className="flex min-w-max whitespace-nowrap items-end justify-center relative w-full z-0" />
          }
        >
          <div className="border-b border-b-(--border) min-w-4 w-full md:w-4" />
          {data.sources.map((v) => (
            <Tabs.Tab
              key={v.name}
              value={v.name}
              render={<li />}
              className={`${roundedClasses} border-b border-b-(--border) p-[1px] data-[selected]:border-b-transparent outline-none select-none before:inset-x-0 focus-visible:relative focus-visible:before:absolute focus-visible:before:outline text-(--description) data-[selected]:text-inherit hover:text-inherit`}
            >
              <h4
                className={`${roundedClasses} text-lg md:text-2xl font-semibold px-2 py-1 backdrop-blur-md`}
              >
                {v.name}
              </h4>
            </Tabs.Tab>
          ))}
          <div className="w-full border-b border-b-(--border) min-w-4" />
          <Tabs.Indicator
            className={`${roundedClasses} border border-(--border) border-b-0 h-full absolute top-1/2 left-0 z-[-1] w-[var(--active-tab-width)] -translate-y-1/2 translate-x-[var(--active-tab-left)] transition-all duration-200 ease-in-out`}
          />
        </Tabs.List>
      </nav>

      {data.sources.map((v) => (
        <Tabs.Panel
          key={v.name}
          value={v.name}
          className={`w-full grid grid-cols-1`}
        >
          <DocxViewer data={v} key={v.name} />
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
};
