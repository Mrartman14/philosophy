"use client";
// src/features/semantic-map/ui/semantic-map.tsx
import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui";

import type { MapData, MapOverlay } from "../types";

const View = dynamic(() => import("./semantic-map-view"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export function SemanticMap({ data, overlay }: { data: MapData; overlay?: MapOverlay }) {
  return <View data={data} {...(overlay !== undefined ? { overlay } : {})} />;
}
