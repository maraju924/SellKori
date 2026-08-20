import { useEffect, useState } from 'react';
import { defaultPublicSiteConfig, type PublicSiteConfig } from './landingContent';

export function usePublicConfig(): { config: PublicSiteConfig; loading: boolean } {
  const [config, setConfig] = useState<PublicSiteConfig>(defaultPublicSiteConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/public/config', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!payload) return;
        setConfig({
          ...defaultPublicSiteConfig(),
          ...payload,
          billing: { ...defaultPublicSiteConfig().billing, ...(payload.billing || {}) },
          landing: { ...defaultPublicSiteConfig().landing, ...(payload.landing || {}) },
        });
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.error('[public config]', error);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return { config, loading };
}
