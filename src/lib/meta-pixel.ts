/**
 * Meta Pixel (fbq) — eventos padrão do funil de diagnóstico e gestão.
 * PageView é disparado em cada navegação SPA via MetaPixelTracker.
 */

export const META_PIXEL_ID = "1014878304387575";

export const META_PIXEL_INIT_SCRIPT = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');`;

export type MetaPixelProduct = {
  id: string;
  name: string;
  category: string;
  value: number;
};

export const DIAGNOSIS_PRODUCT: MetaPixelProduct = {
  id: "diagnosis-meta-ads",
  name: "Diagnóstico Meta Ads",
  category: "diagnosis",
  value: 37,
};

export const GESTAO_PRODUCT: MetaPixelProduct = {
  id: "gestao-meta-ads",
  name: "Gestão de Tráfego Meta Ads",
  category: "gestao",
  value: 1997,
};

const CURRENCY = "BRL" as const;
const DEDUP_PREFIX = "meta_pixel_";

declare global {
  interface Window {
    fbq?: (
      command: "track" | "init",
      eventOrId: string,
      params?: Record<string, unknown>,
    ) => void;
  }
}

function isPixelReady(): boolean {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

function markOnce(key: string): boolean {
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

export function productParams(
  product: MetaPixelProduct,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    content_ids: [product.id],
    content_name: product.name,
    content_type: "product",
    content_category: product.category,
    contents: [{ id: product.id, quantity: 1 }],
    value: product.value,
    currency: CURRENCY,
    num_items: 1,
    ...extra,
  };
}

export function trackMetaPixel(
  event: string,
  params?: Record<string, unknown>,
): void {
  if (!isPixelReady()) return;
  try {
    if (params) window.fbq!("track", event, params);
    else window.fbq!("track", event);
  } catch {
    /* ignore third-party pixel failures */
  }
}

export function trackMetaPageView(): void {
  trackMetaPixel("PageView");
}

export function trackMetaViewContent(
  product: MetaPixelProduct,
  extra?: Record<string, unknown>,
): void {
  trackMetaPixel("ViewContent", productParams(product, extra));
}

export function trackMetaViewContentOnce(
  product: MetaPixelProduct,
  dedupId: string,
  extra?: Record<string, unknown>,
): void {
  const dedupKey = `${DEDUP_PREFIX}view_${product.id}_${dedupId}`;
  if (!markOnce(dedupKey)) return;
  trackMetaViewContent(product, extra);
}

export function trackMetaInitiateCheckout(
  product: MetaPixelProduct,
  extra?: Record<string, unknown>,
): void {
  trackMetaPixel("InitiateCheckout", productParams(product, extra));
}

export function trackMetaAddPaymentInfo(
  product: MetaPixelProduct,
  extra?: Record<string, unknown>,
): void {
  trackMetaPixel("AddPaymentInfo", productParams(product, extra));
}

export function trackMetaPurchase(
  product: MetaPixelProduct,
  orderId: string,
  extra?: Record<string, unknown>,
): void {
  const dedupKey = `${DEDUP_PREFIX}purchase_${product.id}_${orderId}`;
  if (!markOnce(dedupKey)) return;
  trackMetaPixel(
    "Purchase",
    productParams(product, { order_id: orderId, ...extra }),
  );
}

export function trackMetaCompleteRegistration(
  contentName: string,
  extra?: Record<string, unknown>,
  dedupId?: string,
): void {
  const dedupKey = `${DEDUP_PREFIX}registration_${dedupId ?? contentName}`;
  if (!markOnce(dedupKey)) return;
  trackMetaPixel("CompleteRegistration", {
    content_name: contentName,
    status: true,
    currency: CURRENCY,
    ...extra,
  });
}

/** Diagnóstico pago: qualquer status após awaiting_payment. */
export function isDiagnosisPaidStatus(status: string | null | undefined): boolean {
  return Boolean(status && status !== "awaiting_payment");
}

export function trackRoutePixelEvents(pathname: string): void {
  if (pathname === "/") {
    trackMetaViewContent(DIAGNOSIS_PRODUCT);
    return;
  }
  if (pathname === "/checkout") {
    trackMetaInitiateCheckout(DIAGNOSIS_PRODUCT);
    return;
  }
  if (pathname === "/gestao-checkout") {
    trackMetaInitiateCheckout(GESTAO_PRODUCT);
    return;
  }
  if (/^\/diagnostico\/[^/]+\/conectar$/.test(pathname)) {
    trackMetaViewContent(DIAGNOSIS_PRODUCT, {
      content_name: "Conectar conta Meta Ads",
    });
  }
}
