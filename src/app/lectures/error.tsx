"use client";

import RouteError from "@/app/_components/route-error";

export default function LecturesError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} />;
}
