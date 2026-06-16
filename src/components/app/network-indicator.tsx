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

  return (
    <>
      {/* Always-mounted live region: announces offline transition to screen readers */}
      <span role="status" aria-live="polite" aria-atomic="true">
        {!isOnline && <span className="sr-only">Нет сети</span>}
      </span>

      {/* Visual indicator for sighted users; aria-hidden because sr-only text carries the name */}
      {!isOnline && (
        <OfflineIcon
          aria-hidden="true"
          className={`text-amber-600 ${className}`}
        />
      )}
    </>
  );
};
