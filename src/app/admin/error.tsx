// src/app/admin/error.tsx
"use client";

import RouteError from "@/app/_components/route-error";

export default function AdminError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} />;
}
