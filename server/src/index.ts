import "./polyfill";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./rooms/GameRoom";

const port = Number(process.env.PORT) || 2567;
const host = process.env.HOST || "0.0.0.0";

function resolveClientDist(): string | null {
  const candidates = [
    path.resolve(__dirname, "../public"),
    path.resolve(__dirname, "../../client/dist"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}

const clientDist = resolveClientDist();
const hasClientBuild = clientDist !== null;
const clientIndex = hasClientBuild
  ? path.join(clientDist, "index.html")
  : null;

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).send("ok");
});

if (hasClientBuild && clientIndex) {
  app.use(express.static(clientDist));
  app.get("/", (_req, res) => {
    res.sendFile(clientIndex);
  });
} else {
  app.get("/", (_req, res) => {
    res.send(
      "Nuggets server is running. Build the client with: cd server && npm run build",
    );
  });
}

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("game", GameRoom);

gameServer.listen(port, host).then(() => {
  console.log(`HTTP + Colyseus listening on ${host}:${port}`);
  console.log(
    hasClientBuild
      ? `Serving client from ${clientDist}`
      : "Client build not found — run npm run build in server/",
  );
});
