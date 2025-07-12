"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { LessonPageData } from "@/entities/page-data";
import { Tabs } from "@base-ui-components/react/tabs";

type PageProps = React.PropsWithChildren<{
  sources: LessonPageData["sources"];
}>;
export function LectureTabs({ sources, children }: PageProps) {
  const roundedClasses = `rounded-lg rounded-bl-[0px] rounded-br-[0px]`;
  const { slug, source } = useParams();

  return (
    <Tabs.Root value={source} className={`w-full md:mt-[-40px]`}>
      <nav className="w-full grid grid-cols-1 overflow-x-auto">
        <Tabs.List
          render={
            <ul className="flex min-w-max whitespace-nowrap items-end justify-center relative w-full z-0" />
          }
        >
          <div className="border-b border-b-(--border) min-w-4 w-full md:w-4" />
          {sources.map((v) => (
            <Tabs.Tab
              key={v.slug}
              value={v.slug}
              render={<li />}
              className={`${roundedClasses} border-b border-b-(--border) p-[1px] data-[selected]:border-b-transparent outline-none select-none before:inset-x-0 focus-visible:relative focus-visible:before:absolute focus-visible:before:outline text-(--description) data-[selected]:text-inherit hover:text-inherit`}
            >
              <Link href={`/lectures/${slug}/sources/${v.slug}`}>
                <h4
                  className={`${roundedClasses} text-lg md:text-2xl font-semibold px-2 py-1`}
                >
                  {v.name}
                </h4>
              </Link>
            </Tabs.Tab>
          ))}
          <div className="w-full border-b border-b-(--border) min-w-4" />
          <Tabs.Indicator
            className={`${roundedClasses} border border-(--border) border-b-0 h-full absolute top-1/2 left-0 z-[-1] w-[var(--active-tab-width)] -translate-y-1/2 translate-x-[var(--active-tab-left)] transition-all duration-200 ease-in-out`}
          />
        </Tabs.List>
      </nav>

      <Tabs.Panel value={source} className={`w-full grid grid-cols-1`}>
        {children}
      </Tabs.Panel>
    </Tabs.Root>
  );
}
