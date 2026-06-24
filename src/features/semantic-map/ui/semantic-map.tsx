"use client";
// src/features/semantic-map/ui/semantic-map.tsx
import dynamic from "next/dynamic";

import type { ParsedView } from "@/components/scene-3d";
import { Skeleton } from "@/components/ui";

import type { MapData, MapOverlay } from "../types";

const View = dynamic(() => import("./semantic-map-view"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export function SemanticMap({
  data,
  overlay,
  initialView,
}: {
  data: MapData;
  overlay?: MapOverlay;
  initialView: ParsedView;
}) {
  return <View data={data} initialView={initialView} {...(overlay !== undefined ? { overlay } : {})} />;
}
