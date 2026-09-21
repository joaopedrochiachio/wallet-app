const CACHE_NAME = "wallet-pwa-v3";
const PRECACHE_ASSETS = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/logo2.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn("[SW] Erro durante o precache de assets:", err);
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Não interceptar em ambiente de desenvolvimento local
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return;
  }

  // 2. NUNCA interceptar:
  // - Métodos que alteram estado (POST, PUT, DELETE, etc.)
  // - Requisições cross-origin (Firebase Auth, APIs do Google, CDN externa)
  // - Rotas de API interna (/api/)
  // - Handlers, iframes e proxies de autenticação do Firebase (/__/auth/*, /__/firebase/*)
  // - Requisições internas de HMR do Next.js
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/__/") ||
    url.pathname.startsWith("/_next/webpack-hmr")
  ) {
    return;
  }

  // 3. Páginas HTML (request.mode === 'navigate'):
  // Estratégia Network-First para garantir que o usuário sempre veja o conteúdo mais atualizado
  // e evitar conflitos de rotas dinâmicas do Next.js
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const cachedDashboard = await caches.match("/dashboard");
          if (cachedDashboard) return cachedDashboard;
          return new Response("Offline — Conecte-se à internet para continuar.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        })
    );
    return;
  }

  // 4. Recursos estáticos (imagens, ícones, CSS, JS estático):
  // Estratégia Stale-While-Revalidate com cache
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, networkResponse);
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          return new Response("", { status: 408 });
        });
    })
  );
});
