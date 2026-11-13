import { createServer, type Server } from "node:http";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not receive a port");
  }
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe("jsdom cross-origin redirect security", () => {
  it("strips Basic authentication before following a redirect to another origin", async () => {
    let originalAuthorization: string | undefined;
    let redirectedAuthorization: string | undefined;
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
        response.end();
        return;
      }
      originalAuthorization = request.headers.authorization;
      response.writeHead(302, {
        Location: `${destinationUrl}/target`,
        "Access-Control-Allow-Origin": "*",
      });
      response.end();
    });
    const sourceUrl = await listen(source);
    const dom = new JSDOM("", { url: sourceUrl });
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new dom.window.XMLHttpRequest();
        xhr.open(
          "GET",
          `${sourceUrl}/redirect`,
          true,
          "test-user",
          "test-password",
        );
        xhr.timeout = 5000;
        xhr.onload = () => resolve();
        xhr.onerror = () => reject(new Error("Redirect request failed"));
        xhr.ontimeout = () => reject(new Error("Redirect request timed out"));
        xhr.send();
      });
      expect(originalAuthorization).toBe(
        `Basic ${Buffer.from("test-user:test-password").toString("base64")}`,
      );
      expect(redirectedRequests).toBe(1);
      expect(redirectedAuthorization).toBeUndefined();
    } finally {
      dom.window.close();
      await Promise.all([close(source), close(destination)]);
    }
  });
});
