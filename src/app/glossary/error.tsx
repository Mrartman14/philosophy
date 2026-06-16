"use client";

import RouteError from "@/app/_components/route-error";

export default function GlossaryError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} />;
}
