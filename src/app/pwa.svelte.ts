// Service worker registration. Updates are offered, never forced: the banner only appears outside
// the question flow, and the page reloads only when the user taps Update.
import { registerSW } from 'virtual:pwa-register';

class Pwa {
  needRefresh = $state(false);
  offlineReady = $state(false);
  private update: ((reload?: boolean) => Promise<void>) | null = null;

  init(): void {
    if (!('serviceWorker' in navigator)) return;
    this.update = registerSW({
      onNeedRefresh: () => (this.needRefresh = true),
      onOfflineReady: () => (this.offlineReady = true),
    });
  }

  async apply(): Promise<void> {
    this.needRefresh = false;
    await this.update?.(true);
  }

  dismiss(): void {
    this.needRefresh = false;
  }
}

export const pwa = new Pwa();
