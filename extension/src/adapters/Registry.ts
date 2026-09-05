import { PlayerAdapter } from '../types/adapter';
import { NetflixAdapter } from './NetflixAdapter';

export class AdapterRegistry {
  private static instance: AdapterRegistry;
  private adapters: Map<string, PlayerAdapter> = new Map();

  private constructor() {
    this.register(new NetflixAdapter());
  }

  public static getInstance(): AdapterRegistry {
    if (!AdapterRegistry.instance) {
      AdapterRegistry.instance = new AdapterRegistry();
    }
    return AdapterRegistry.instance;
  }

  public register(adapter: PlayerAdapter): void {
    this.adapters.set(adapter.siteId, adapter);
  }

  public getAdapter(siteId: string): PlayerAdapter | undefined {
    return this.adapters.get(siteId);
  }

  public getAllAdapters(): PlayerAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Resolves the matching adapter based on the current window location or a URL string.
   */
  public async resolveForUrl(url: string): Promise<PlayerAdapter | null> {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('netflix.com')) {
        const adapter = this.adapters.get('netflix');
        if (adapter && (await adapter.isAvailable())) {
          return adapter;
        }
      }
    } catch {
      // Invalid URL format
    }
    return null;
  }
}
