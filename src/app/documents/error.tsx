"use client";

import RouteError from "@/app/_components/route-error";

export default function DocumentsError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} />;
}
