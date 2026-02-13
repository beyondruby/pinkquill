interface RequestMetricEventInput {
  url: RequestInfo | URL;
  options?: RequestInit;
  status?: number;
  durationMs: number;
  errorName?: string;
}

interface RouteMetricBucket {
  routeKey: string;
  total: number;
  ok: number;
  badRequest: number;
  clientError: number;
  serverError: number;
  networkError: number;
  totalDurationMs: number;
  byEndpoint: Record<string, number>;
  byMethod: Record<string, number>;
  lastStatus: number | null;
  lastError: string | null;
  lastUpdatedAt: number;
}

interface RouteMetricSummary {
  routeKey: string;
  total: number;
  ok: number;
  badRequest: number;
  clientError: number;
  serverError: number;
  networkError: number;
  avgDurationMs: number;
  byEndpoint: Record<string, number>;
  byMethod: Record<string, number>;
  lastStatus: number | null;
  lastError: string | null;
  lastUpdatedAt: number;
}

interface RequestMetricSnapshot {
  generatedAt: number;
  activeScope: string | null;
  routes: Record<string, RouteMetricSummary>;
}

interface RequestMetricsStore {
  routes: Record<string, RouteMetricBucket>;
  activeScope: string | null;
  reset: () => void;
  snapshot: () => RequestMetricSnapshot;
  setScope: (scope: string | null) => void;
  record: (event: {
    routeKey: string;
    endpoint: string;
    method: string;
    status: number;
    durationMs: number;
    errorName: string | null;
  }) => void;
}

declare global {
  interface Window {
    __pinkquillRequestMetrics?: RequestMetricsStore;
  }
}

function createStore(): RequestMetricsStore {
  const store: RequestMetricsStore = {
    routes: {},
    activeScope: null,
    reset: () => {
      store.routes = {};
    },
    snapshot: () => {
      const routes: Record<string, RouteMetricSummary> = {};
      Object.entries(store.routes).forEach(([routeKey, bucket]) => {
        routes[routeKey] = {
          routeKey,
          total: bucket.total,
          ok: bucket.ok,
          badRequest: bucket.badRequest,
          clientError: bucket.clientError,
          serverError: bucket.serverError,
          networkError: bucket.networkError,
          avgDurationMs: bucket.total > 0 ? Math.round((bucket.totalDurationMs / bucket.total) * 100) / 100 : 0,
          byEndpoint: { ...bucket.byEndpoint },
          byMethod: { ...bucket.byMethod },
          lastStatus: bucket.lastStatus,
          lastError: bucket.lastError,
          lastUpdatedAt: bucket.lastUpdatedAt,
        };
      });
      return {
        generatedAt: Date.now(),
        activeScope: store.activeScope,
        routes,
      };
    },
    setScope: (scope: string | null) => {
      store.activeScope = scope;
    },
    record: ({ routeKey, endpoint, method, status, durationMs, errorName }) => {
      const bucket = store.routes[routeKey] || {
        routeKey,
        total: 0,
        ok: 0,
        badRequest: 0,
        clientError: 0,
        serverError: 0,
        networkError: 0,
        totalDurationMs: 0,
        byEndpoint: {},
        byMethod: {},
        lastStatus: null,
        lastError: null,
        lastUpdatedAt: Date.now(),
      };

      bucket.total += 1;
      bucket.totalDurationMs += Math.max(0, durationMs);
      bucket.byEndpoint[endpoint] = (bucket.byEndpoint[endpoint] || 0) + 1;
      bucket.byMethod[method] = (bucket.byMethod[method] || 0) + 1;
      bucket.lastStatus = status;
      bucket.lastError = errorName;
      bucket.lastUpdatedAt = Date.now();

      if (status === 0) {
        bucket.networkError += 1;
      } else if (status >= 200 && status < 400) {
        bucket.ok += 1;
      } else if (status >= 400 && status < 500) {
        bucket.clientError += 1;
        if (status === 400) {
          bucket.badRequest += 1;
        }
      } else if (status >= 500) {
        bucket.serverError += 1;
      }

      store.routes[routeKey] = bucket;
    },
  };

  return store;
}

function getStore(): RequestMetricsStore | null {
  if (typeof window === "undefined") return null;
  if (!window.__pinkquillRequestMetrics) {
    window.__pinkquillRequestMetrics = createStore();
  }
  return window.__pinkquillRequestMetrics;
}

function getRequestMethod(options?: RequestInit): string {
  return (options?.method || "GET").toUpperCase();
}

function parseEndpointLabel(url: RequestInfo | URL): string {
  const raw = typeof url === "string"
    ? url
    : url instanceof URL
    ? url.toString()
    : url.url;

  let pathName = raw;
  try {
    const parsed = new URL(raw, "http://localhost");
    pathName = parsed.pathname;
  } catch {
    // Keep raw fallback.
  }

  const restPrefix = "/rest/v1/";
  const restIndex = pathName.indexOf(restPrefix);
  if (restIndex >= 0) {
    const restPath = pathName.slice(restIndex + restPrefix.length);
    if (restPath.startsWith("rpc/")) {
      return `rpc:${restPath.slice(4).split("/")[0] || "unknown"}`;
    }
    return `table:${restPath.split("/")[0] || "unknown"}`;
  }

  if (pathName.includes("/auth/v1/")) return "auth";
  if (pathName.includes("/storage/v1/")) return "storage";
  if (pathName.includes("/realtime/v1/")) return "realtime";
  return pathName;
}

export function setRequestMetricsScope(scope: string | null) {
  const store = getStore();
  if (!store) return;
  store.setScope(scope);
}

export function resetRequestMetrics() {
  const store = getStore();
  if (!store) return;
  store.reset();
}

export function getRequestMetricsSnapshot(): RequestMetricSnapshot | null {
  const store = getStore();
  if (!store) return null;
  return store.snapshot();
}

export function recordRequestMetric({
  url,
  options,
  status,
  durationMs,
  errorName,
}: RequestMetricEventInput) {
  const store = getStore();
  if (!store) return;

  const pathname = window.location.pathname || "unknown";
  const routeKey = store.activeScope
    ? `${pathname}::${store.activeScope}`
    : pathname;

  store.record({
    routeKey,
    endpoint: parseEndpointLabel(url),
    method: getRequestMethod(options),
    status: typeof status === "number" ? status : 0,
    durationMs,
    errorName: errorName || null,
  });
}

