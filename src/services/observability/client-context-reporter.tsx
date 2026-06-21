"use client";

// Монтируется один раз в root-layout. Прокидывает per-session актора (уже
// хешированного на сервере — сырой id на клиент не уходит) и текущий маршрут
// в клиентский контекст наблюдаемости. Client-safe barrel.
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { setClientActor, setClientRoute } from "./client";

interface Props {
  actorHash: string | null;
  actorRole: string | null;
}

export function ClientContextReporter({ actorHash, actorRole }: Props): null {
  const pathname = usePathname();

  useEffect(() => {
    if (actorHash) setClientActor(actorHash, actorRole ?? "");
  }, [actorHash, actorRole]);

  useEffect(() => {
    if (pathname) setClientRoute(pathname);
  }, [pathname]);

  return null;
}
