/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { db, uid } from './db';

declare let self: ServiceWorkerGlobalScope;

self.addEventListener('install', () => {
  void self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

precacheAndRoute(self.__WB_MANIFEST);

// The Android share sheet posts shared screenshots here. We tuck them into
// the database and send Jillian straight to the "Which task is this for?" screen.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith(
      (async () => {
        try {
          const form = await event.request.formData();
          const files = form.getAll('images').filter((f): f is File => f instanceof File);
          for (const file of files) {
            if (file.type.startsWith('image/')) {
              await db.pendingShares.add({ id: uid(), blob: file, createdAt: Date.now() });
            }
          }
        } catch {
          // if the form can't be read, still land her in the app
        }
        return Response.redirect(new URL('./#/share', self.registration.scope).href, 303);
      })()
    );
  }
});

// Offline: any navigation falls back to the app shell.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/share-target/]
  })
);
