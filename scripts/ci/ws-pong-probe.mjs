import assert from "node:assert/strict";
import { once } from "node:events";
import WebSocket, { WebSocketServer } from "ws";

const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
let client;
let peer;
try {
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  const connected = once(server, "connection");
  client = new WebSocket(`ws://127.0.0.1:${address.port}`);
  [peer] = await connected;
  await once(client, "open");

  const scenario = process.argv[2];
  if (scenario === "round-trip") {
    const received = once(client, "message");
    peer.send("offer navigation remains available");
    const [message] = await received;
    assert.equal(message.toString(), "offer navigation remains available");
    const pong = once(client, "pong");
    client.ping("normal-ping");
    const [data] = await pong;
    assert.equal(data.toString(), "normal-ping");
  } else {
    const socket = scenario === "client-cap" ? client : peer;
    // Hold completion callbacks, deterministically simulating a slow socket
    // without exhausting memory or depending on OS buffering thresholds.
    const callbacks = [];
    socket.pong = (_data, _mask, callback) => callbacks.push(callback);
    assert.equal(socket._maxPendingAutoPongs, 60);
    for (let i = 0; i < 60; i++) {
      socket._receiver.emit("ping", Buffer.from("ping"));
    }
    assert.equal(socket.readyState, WebSocket.OPEN);
    assert.equal(socket._pendingAutoPongs, 60);
    assert.equal(callbacks.length, 60);
    if (scenario === "drain") {
      for (const callback of callbacks) callback();
      assert.equal(socket._pendingAutoPongs, 0);
      socket._receiver.emit("ping", Buffer.from("ping"));
      assert.equal(socket.readyState, WebSocket.OPEN);
      assert.equal(socket._pendingAutoPongs, 1);
    } else {
      assert(["server-cap", "client-cap"].includes(scenario));
      socket._receiver.emit("ping", Buffer.from("ping"));
      assert.notEqual(socket.readyState, WebSocket.OPEN);
      assert.equal(callbacks.length, 60);
      assert.equal(socket._pendingAutoPongs, 60);
    }
  }
} finally {
  client?.terminate();
  peer?.terminate();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
