self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const tab = windows.find((client) => client.url.startsWith(self.registration.scope));
    return tab ? tab.focus() : clients.openWindow(self.registration.scope);
  }));
});
