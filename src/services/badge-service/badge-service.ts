/* eslint-disable @typescript-eslint/no-explicit-any */

class AppBadgeService {
  async updateAppBadge(count: number) {
    if ("setAppBadge" in navigator) {
      try {
        if (count > 0) {
          await (navigator as any).setAppBadge(count);
        } else {
          await (navigator as any).clearAppBadge();
        }
      } catch (err) {
        console.error("App badge service error: ", err);
      }
    }
  }
}

export const appBadgeService = new AppBadgeService();
