import assert from "node:assert/strict";
import { createServer } from "node:http";
import { JSDOM } from "jsdom";

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing port");
  return `http://127.0.0.1:${address.port}`;
}

let originalAuthorization;
let redirectedAuthorization;
let redirectedRequests = 0;
const destination = createServer((request, response) => {
  redirectedRequests += 1;
  redirectedAuthorization = request.headers.authorization;
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.end("ok");
});
const destinationUrl = await listen(destination);
const source = createServer((request, response) => {
  if (!request.headers.authorization) {
    response.writeHead(401, { "WWW-Authenticate": 'Basic realm="test"' });
  } else {
    originalAuthorization = request.headers.authorization;
    response.writeHead(302, { Location: `${destinationUrl}/target` });
  }
  response.end();
});
const sourceUrl = await listen(source);
const dom = new JSDOM("", { url: sourceUrl });
try {
  await new Promise((resolve, reject) => {
    const xhr = new dom.window.XMLHttpRequest();
    xhr.open("GET", sourceUrl, true, "test-user", "test-password");
    xhr.timeout = 5000;
    xhr.onload = () => resolve();
    xhr.onerror = () => reject(new Error("Redirect request failed"));
    xhr.ontimeout = () => reject(new Error("Redirect request timed out"));
    xhr.send();
  });
  assert.equal(
    originalAuthorization,
    `Basic ${Buffer.from("test-user:test-password").toString("base64")}`,
  );
  assert.equal(redirectedRequests, 1);
  assert.equal(redirectedAuthorization, undefined);
} finally {
  dom.window.close();
  await Promise.all(
    [source, destination].map((server) => {
      server.closeAllConnections();
      return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }),
  );
}
