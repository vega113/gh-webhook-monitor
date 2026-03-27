import { WebSocketServer, WebSocket } from "ws";

function createLiveHub(server, snapshotProvider) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  let lastSerialized = "";

  async function snapshotMessage() {
    const snapshot = await snapshotProvider();
    return JSON.stringify({ type: "snapshot", snapshot });
  }

  async function broadcastSnapshot(force = false) {
    const message = await snapshotMessage();
    if (!force && message === lastSerialized) return;
    lastSerialized = message;
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  wss.on("connection", async (ws) => {
    ws.on("error", console.error);
    ws.send(await snapshotMessage());
  });

  return {
    broadcastSnapshot,
    close: () => wss.close(),
  };
}

export { createLiveHub };
