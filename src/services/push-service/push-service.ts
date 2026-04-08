const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

class PushService {
  async getSubscription(): Promise<PushSubscription | null> {
    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
  }

  async subscribe(): Promise<PushSubscription> {
    if (!VAPID_PUBLIC_KEY) {
      throw new Error("[PushService] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured");
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    await this.sendSubscriptionToServer(subscription);
    return subscription;
  }

  async unsubscribe(): Promise<void> {
    const subscription = await this.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      // TODO: notify server about unsubscription
    }
  }

  getPermission(): NotificationPermission {
    return Notification.permission;
  }

  /** TODO: implement when backend is ready */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async sendSubscriptionToServer(_sub: PushSubscription): Promise<void> {
    // Will POST subscription to backend endpoint
  }
}

export const pushService = new PushService();
