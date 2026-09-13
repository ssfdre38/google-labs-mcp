const http = require("http");
const { WebSocketServer } = require("ws");

class ChromeExtensionBridge {
  constructor(port = 18885) {
    this.port = port;
    this.server = null;
    this.wss = null;
    this.activeSocket = null;
    this.pendingRequests = new Map();
    this.reqIdCounter = 1;
    this.isListening = false;
  }

  start() {
    if (this.isListening) return;

    this.server = http.createServer((req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "*");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          status: "ok",
          extensionConnected: !!(this.activeSocket && this.activeSocket.readyState === 1),
          timestamp: new Date().toISOString()
        }));
        return;
      }

      if (req.url === "/rpc" && req.method === "POST") {
        let body = "";
        req.on("data", chunk => { body += chunk; });
        req.on("end", async () => {
          try {
            const parsed = JSON.parse(body || "{}");
            const { method, params } = parsed;
            const result = await this.sendRpc(method, params || {});
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, result }));
          } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    this.wss = new WebSocketServer({ server: this.server });
    this.wss.on("error", () => {});

    this.wss.on("connection", (ws) => {
      console.error("[Google Labs Bridge] Chrome Companion Extension connected via WebSocket!");
      this.activeSocket = ws;

      const heartbeatTimer = setInterval(() => {
        if (ws.readyState === 1) {
          try {
            ws.send(JSON.stringify({ method: "ping", params: {} }));
          } catch {}
        } else {
          clearInterval(heartbeatTimer);
        }
      }, 20000);

      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.event === "companion_registered") {
            console.error("[Google Labs Bridge] Extension handshake completed, version:", msg.version);
            return;
          }

          if (msg.event === "ping" || msg.method === "ping") {
            try { ws.send(JSON.stringify({ event: "pong", timestamp: Date.now() })); } catch {}
            return;
          }

          if (msg.id && this.pendingRequests.has(msg.id)) {
            const { resolve, reject, timer } = this.pendingRequests.get(msg.id);
            clearTimeout(timer);
            this.pendingRequests.delete(msg.id);

            if (msg.success) {
              resolve(msg.result);
            } else {
              reject(new Error(msg.error || "Extension RPC failed"));
            }
          }
        } catch (e) {
          console.error("[Google Labs Bridge] Error parsing message:", e);
        }
      });

      ws.on("close", () => {
        console.error("[Google Labs Bridge] Extension disconnected.");
        clearInterval(heartbeatTimer);
        if (this.activeSocket === ws) {
          this.activeSocket = null;
        }
      });

      ws.on("error", (err) => {
        console.error("[Google Labs Bridge] Socket error:", err.message);
        clearInterval(heartbeatTimer);
      });
    });

    this.server.listen(this.port, "127.0.0.1", () => {
      console.error(`[Google Labs Bridge] Extension WebSocket Bridge listening on ws://127.0.0.1:${this.port}`);
      this.isListening = true;
    });

    this.server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`[Google Labs Bridge] Port ${this.port} already in use. Bridge will operate in passive mode.`);
      } else {
        console.error("[Google Labs Bridge] Server error:", err);
      }
    });
  }

  isConnected() {
    return !!(this.activeSocket && this.activeSocket.readyState === 1);
  }

  async sendRpc(method, params = {}, timeoutMs = 30000) {
    if (!this.isConnected()) {
      // If running as secondary process or client, forward to active daemon via HTTP /rpc
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/rpc`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method, params }),
          signal: AbortSignal.timeout(timeoutMs)
        });
        const data = await res.json();
        if (data.success) return data.result;
        throw new Error(data.error || "Extension RPC failed");
      } catch (err) {
        throw new Error(`Chrome Companion Extension is not connected (${err.message})`);
      }
    }

    const id = `req-${Date.now()}-${this.reqIdCounter++}`;
    const payload = JSON.stringify({ id, method, params });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Extension RPC timeout (${method}) after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.activeSocket.send(payload);
    });
  }

  async getStatus() {
    return await this.sendRpc("get_status");
  }

  async openOrFocusFlow(url = "https://flow.google.com/") {
    return await this.sendRpc("open_or_focus_flow", { url });
  }

  async injectPrompt(prompt) {
    return await this.sendRpc("inject_prompt", { prompt });
  }

  async approveRender() {
    return await this.sendRpc("approve_render");
  }

  async captureScreenshot() {
    return await this.sendRpc("capture_screenshot");
  }

  async clickDownloadBatch() {
    return await this.sendRpc("click_download_batch");
  }

  async cdpCommand(method, params = {}, tabId = null) {
    return await this.sendRpc("cdp_command", { method, params, tabId });
  }
}

let bridgeInstance = null;
function getExtensionBridge(port = 18885) {
  if (!bridgeInstance) {
    bridgeInstance = new ChromeExtensionBridge(port);
    bridgeInstance.start();
  }
  return bridgeInstance;
}

module.exports = { ChromeExtensionBridge, getExtensionBridge };
