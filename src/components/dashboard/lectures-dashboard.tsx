"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

import { Slider } from "../shared/slider/slider";
import { LectureCard } from "../lecture/lecture-card";
import { LectureServiceProvider } from "../providers/lecture-service-provider";

export const LecturesDashboard: React.FC = () => {
  return (
    <LectureServiceProvider>
      {({ favLectures, lastViewedLectures, lectures, onSelectFav }) => (
        <>
          <section className="flex flex-col gap-4">
            <h2 className="text-3xl font-bold pb-2 p-4 border-b border-(--border) underline">
              Избранное
            </h2>
            <motion.div
              layout
              className="width-full p-4 gap-4 flex flex-nowrap overflow-scroll"
            >
              <AnimatePresence>
                {favLectures.map((x) => (
                  <motion.div
                    key={x.slug}
                    layout
                    initial={{
                      opacity: 0,
                      scale: 0.5,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0,
                    }}
                    transition={{
                      duration: 0.3,
                    }}
                    className="grid grow-0 shrink-0 basis-[200px] md:basis-[300px] h-[150px] md:h-[200px]"
                  >
                    <LectureCard
                      key={x.slug}
                      lecture={x}
                      onSelectFav={() => onSelectFav(x.slug)}
                      isFav={favLectures.some((y) => y.slug === x.slug)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-3xl font-bold pb-2 p-4 border-b border-(--border) underline">
              История посещений
            </h2>
            <div className="width-full p-4 gap-4 flex flex-nowrap overflow-scroll">
              {lastViewedLectures.map((x) => (
                <LectureCard
                  key={x.slug}
                  lecture={x}
                  onSelectFav={() => onSelectFav(x.slug)}
                  isFav={favLectures.some((y) => y.slug === x.slug)}
                  className="grow-0 shrink-0 basis-[200px] md:basis-[300px] h-[150px] md:h-[200px]"
                />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <Link href="/lectures" className="font-bold underline">
              <h2 className="text-3xl font-bold flex gap-2 px-4 pb-2 border-b border-b-(--border)">
                <span className="fancy-link">Все лекции</span>
              </h2>
            </Link>
            <Slider
              trackClassName="pl-4 gap-4"
              itemClassName="shrink-0 grow-0 basis-[200px] md:basis-[300px]"
              items={lectures.map((x) => (
                <LectureCard
                  key={x.slug}
                  lecture={x}
                  onSelectFav={() => onSelectFav(x.slug)}
                  isFav={favLectures.some((y) => y.slug === x.slug)}
                  className="h-[150px] md:h-[200px]"
                />
              ))}
            />
          </section>
        </>
      )}
    </LectureServiceProvider>
  );
};
