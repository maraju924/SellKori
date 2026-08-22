import { useEffect } from 'react';

type MetaInput = {
  title: string;
  description?: string;
  url?: string;
  image?: string;
  type?: 'website' | 'product';
  jsonLd?: unknown[];
  price?: number;
};

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attr}="${key}"][data-shop-seo="1"]`;
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    el.setAttribute('data-shop-seo', '1');
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"][data-shop-seo="1"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    el.setAttribute('data-shop-seo', '1');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function useDocumentMeta(input: MetaInput) {
  const jsonLd = JSON.stringify(input.jsonLd || []);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const previousTitle = document.title;
    document.title = input.title;
    if (input.description) {
      upsertMeta('name', 'description', input.description);
      upsertMeta('property', 'og:description', input.description);
      upsertMeta('name', 'twitter:description', input.description);
    }
    upsertMeta('property', 'og:title', input.title);
    upsertMeta('property', 'og:type', input.type === 'product' ? 'product' : 'website');
    upsertMeta('property', 'og:locale', 'bn_BD');
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', input.title);
    upsertMeta('name', 'robots', 'index,follow');
    if (input.url) {
      upsertLink('canonical', input.url);
      upsertMeta('property', 'og:url', input.url);
    }
    if (input.image) {
      upsertMeta('property', 'og:image', input.image);
      upsertMeta('name', 'twitter:image', input.image);
    }
    if (input.type === 'product' && input.price != null) {
      upsertMeta('property', 'product:price:amount', String(Math.round(input.price)));
      upsertMeta('property', 'product:price:currency', 'BDT');
    }

    let script = document.getElementById('sellkori-jsonld') as HTMLScriptElement | null;
    if (input.jsonLd && input.jsonLd.length) {
      if (!script) {
        script = document.createElement('script');
        script.id = 'sellkori-jsonld';
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = jsonLd;
    } else if (script) {
      script.remove();
    }

    return () => {
      document.title = previousTitle;
      document.head.querySelectorAll('[data-shop-seo="1"]').forEach(node => node.remove());
      document.getElementById('sellkori-jsonld')?.remove();
    };
  }, [
    input.title,
    input.description,
    input.url,
    input.image,
    input.type,
    input.price,
    jsonLd,
  ]);
}
