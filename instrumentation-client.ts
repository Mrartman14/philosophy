// instrumentation-client.ts — Next.js client instrumentation entrypoint.
// Инициализирует клиентскую observability и вешает глобальные обработчики
// ошибок/реджектов. Логика — в @/services/observability (покрыта тестами).
import {
  initClientObservability,
} from "@/services/observability/client";
import { registerClientErrorHandlers } from "@/services/observability/register-client-error-handlers";

initClientObservability();
registerClientErrorHandlers(window);
