"use client";

import { useState, useEffect } from "react";
// import { subscribeUser, unsubscribeUser, sendNotification } from "../actions";
import { SWProvider, SWProviderState } from "@/app/_providers/sw-provider";

// for more detailed guide see https://nextjs.org/docs/app/guides/progressive-web-apps

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function PushNotificationManager({
  isSupported,
  subscription,
  //   setIsSupported,
  setSubscription,
}: SWProviderState) {
  const [message, setMessage] = useState("");

  async function subscribeToPush() {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      ),
    });
    setSubscription(sub);
    // const serializedSub = JSON.parse(JSON.stringify(sub));
    // await subscribeUser(serializedSub);
  }

  async function unsubscribeFromPush() {
    await subscription?.unsubscribe();
    setSubscription(null);
    // await unsubscribeUser();
  }

  async function sendTestNotification() {
    if (subscription) {
      //   await sendNotification(message);
      setMessage("");
    }
  }

  if (!isSupported) {
    return <p>Push notifications are not supported in this browser.</p>;
  }

  return (
    <div className="p-4 border border-(--border)">
      <h1>Push Notifications</h1>
      {subscription ? (
        <div className="flex flex-col gap-4">
          <p>You are subscribed to push notifications.</p>
          <button
            className="border border-(--border)"
            onClick={unsubscribeFromPush}
          >
            Unsubscribe
          </button>
          <input
            type="text"
            className="border border-(--border)"
            placeholder="Enter notification message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button
            className="border border-(--border)"
            onClick={sendTestNotification}
          >
            Send Test
          </button>
        </div>
      ) : (
        <>
          <p>You are not subscribed to push notifications.</p>
          <button
            className="border border-(--border)"
            onClick={subscribeToPush}
          >
            Subscribe
          </button>
        </>
      )}
    </div>
  );
}

function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsIOS(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    );

    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
  }, []);

  if (isStandalone) {
    return null; // Don't show install button if already installed
  }

  return (
    <div className="p-4 border border-(--border)">
      <h1>Install App</h1>
      <button className="border border-(--border)">Add to Home Screen</button>
      {isIOS ? (
        <p>
          To install this app on your iOS device, tap the share button
          <span role="img" aria-label="share icon">
            {" "}
            ⎋{" "}
          </span>
          and then «Add to Home Screen»
          <span role="img" aria-label="plus icon">
            {" "}
            +{" "}
          </span>
          .
        </p>
      ) : (
        <p>only IOS supported yet ;(</p>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <div className="prose dark:prose-invert">
      <SWProvider>
        {(state) => <PushNotificationManager {...state} />}
      </SWProvider>
      <InstallPrompt />
    </div>
  );
}
