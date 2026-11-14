/* Service worker — Conexão em Farmacologia
 * Só cuida das notificações no celular. Não guarda páginas em cache,
 * então não interfere nas atualizações da plataforma. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch (e) {
    dados = { title: "Conexão em Farmacologia", body: event.data ? event.data.text() : "" };
  }
  const titulo = dados.title || "Conexão em Farmacologia";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.body || "",
      icon: "/icon-192.png",
      badge: "/icon-badge.png",
      tag: dados.tag || "conexao",
      renotify: true,
      data: { url: dados.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if (j.url.startsWith(self.location.origin) && "focus" in j) {
          j.navigate(destino);
          return j.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
