"use client";

// Монтируется один раз в root-layout. Перекладывает Next web-vitals в metrics
// как гистограммы web_vitals.<NAME> с rating-атрибутом. Client-safe barrel.
import { useReportWebVitals } from "next/web-vitals";

import { metrics } from "./client";
import { webVital } from "./core/names";

interface WebVitalMetric {
  name: string;
  value: number;
  rating: string;
}

export function WebVitalsReporter(): null {
  useReportWebVitals((metric: WebVitalMetric) => {
    metrics.histogram(webVital(metric.name), metric.value, {
      rating: metric.rating,
    });
  });
  return null;
}
