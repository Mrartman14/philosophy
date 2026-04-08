"use client";

import { useSyncExternalStore } from "react";
import { OfflineIcon } from "@/assets/icons/offline-icon";

function subscribeToOnlineStatus(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export const NetworkIndicator: React.FC<{ className?: string }> = ({
  className,
}) => {
  const isOnline = useSyncExternalStore(
    subscribeToOnlineStatus,
    getSnapshot,
    getServerSnapshot,
  );

  return !isOnline ? (
    <OfflineIcon className={`text-amber-600 ${className}`} />
  ) : null;
};
