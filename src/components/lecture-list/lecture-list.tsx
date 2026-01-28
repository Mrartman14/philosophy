"use client";

import { LectureCard } from "../lecture/lecture-card";
import { LectureServiceProvider } from "../providers/lecture-service-provider";
import {
  groupByNestedSection,
  countLecturesInNode,
  type SectionNode,
} from "@/utils/group-by-nested-section";
import type { LecturePageData } from "@/entities/page-data";

type SectionRendererProps = {
  node: SectionNode;
  depth: number;
  favLectures: LecturePageData[];
  onSelectFav: (slug: string) => void;
};

const SectionRenderer: React.FC<SectionRendererProps> = ({
  node,
  depth,
  favLectures,
  onSelectFav,
}) => {
  const totalCount = countLecturesInNode(node);
  const HeadingTag = depth === 0 ? "h2" : depth === 1 ? "h3" : "h4";
  const headingSize =
    depth === 0 ? "text-3xl" : depth === 1 ? "text-2xl" : "text-xl";
  const paddingLeft = depth > 0 ? `pl-${Math.min(depth * 4, 12)}` : "";

  return (
    <section className={`w-full grid ${paddingLeft}`} key={node.name}>
      <div
        className={`border-b border-(--border) py-2 px-4 md:px-6 ${depth > 0 ? "border-l-2 border-l-(--primary)" : ""}`}
      >
        <HeadingTag className={`inline ${headingSize} font-semibold relative`}>
          {node.name}
          <span className="absolute left-full text-sm text-(--description)">
            {totalCount}
          </span>
        </HeadingTag>
      </div>

      {/* Лекции текущего уровня */}
      {node.lectures.length > 0 && (
        <div
          className={`grid p-4 gap-4 auto-rows-[300px] md:auto-rows-[250px] md:gap-6 md:p-6`}
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          }}
        >
          {node.lectures.map((x) => (
            <LectureCard
              key={x.slug}
              lecture={x}
              onSelectFav={() => onSelectFav(x.slug)}
              isFav={favLectures.some((y) => y.slug === x.slug)}
            />
          ))}
        </div>
      )}

      {/* Вложенные подразделы */}
      {node.children.map((child) => (
        <SectionRenderer
          key={child.name}
          node={child}
          depth={depth + 1}
          favLectures={favLectures}
          onSelectFav={onSelectFav}
        />
      ))}
    </section>
  );
};

export const LectureList: React.FC = () => {
  return (
    <LectureServiceProvider>
      {({ lectures, favLectures, onSelectFav }) => {
        const sectionTree = groupByNestedSection(lectures);
        return sectionTree.map((node) => (
          <SectionRenderer
            key={node.name}
            node={node}
            depth={0}
            favLectures={favLectures}
            onSelectFav={onSelectFav}
          />
        ));
      }}
    </LectureServiceProvider>
  );
};
