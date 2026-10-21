/**
 * SERVICE WORKER: игра открывается без сети и не перекачивает арт заново.
 *
 * Зачем он веб-версии: установленная PWA должна запускаться как приложение (в метро
 * без интернета), а 1 МБ webp-фонов и музыку нельзя качать при каждом открытии.
 * В Telegram этот же воркер не мешает — просто работает и там.
 *
 * Правила:
 *  - чужие источники (Supabase, telegram.org) не трогаем вообще: это данные, а не
 *    статика, и кэшировать их нельзя;
 *  - навигация — network-first с откатом на кэш: игрок всегда получает свежую
 *    версию, а без сети — последнюю рабочую;
 *  - своё остальное (хешированные /assets/*, /bg/*, /sprites/*, музыка) —
 *    cache-first: имя файла меняется вместе с содержимым, устареть они не могут.
 *
 * ВАЖНО: версия кэша меняется руками. Старые кэши удаляются на activate, поэтому
 * «залипшая» версия игры не переживёт смену CACHE.
 */
const CACHE = "croak-v2";

/** Оболочка: минимум, чтобы приложение открылось без сети. */
const SHELL = ["/", "/index.html", "/manifest.webmanifest"];

/** Годится ли ответ для кэша: целый (не 206 на Range) и своего источника. */
const isCacheable = (request, response) =>
  Boolean(response) &&
  response.ok &&
  response.status === 200 &&
  response.type === "basic" &&
  !request.headers.has("range");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** Сеть вперёд, кэш — спасательный круг (страница и разметка). */
const networkFirst = async (request) => {
  const cache = await caches.open(CACHE);

  try {
    const response = await fetch(request);

    if (isCacheable(request, response)) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const cached = await cache.match(request);

    return cached ?? (await cache.match("/index.html")) ?? Response.error();
  }
};

/** Кэш вперёд (хешированные ассеты, арт, музыка). */
const cacheFirst = async (request) => {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    if (isCacheable(request, response)) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    return Response.error();
  }
};

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Чужие источники (Supabase, telegram.org) и серверные функции — только сеть.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/functions/")) {
    return;
  }

  event.respondWith(
    request.mode === "navigate" ? networkFirst(request) : cacheFirst(request)
  );
});
