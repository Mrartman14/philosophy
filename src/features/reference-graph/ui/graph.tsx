"use client";
// src/features/reference-graph/ui/graph.tsx
import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui";

import type { GraphData } from "../types";

const View = dynamic(() => import("./graph-view"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export function Graph({ data }: { data: GraphData }) {
  return <View data={data} />;
}
