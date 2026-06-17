"use client";

// Хук для App-Router error-boundary: репортит словленную React'ом ошибку
// как unhandled, с digest из Next. Импортит client-safe barrel (не server-only).
import { useEffect } from "react";

import { errors } from "./client";

export function useReportBoundaryError(error: Error & { digest?: string }): void {
  useEffect(() => {
    errors.capture(error, {
      handled: false,
      attributes: { digest: error.digest ?? null },
    });
  }, [error]);
}
