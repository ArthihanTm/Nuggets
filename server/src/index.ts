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
const clientDist = path.resolve(__dirname, "../../client/dist");
const clientIndex = path.join(clientDist, "index.html");
const hasClientBuild = fs.existsSync(clientIndex);

const app = express();
app.use(cors());
app.use(express.json());

if (hasClientBuild) {
  app.use(express.static(clientDist));
  app.get("/", (_req, res) => {
    res.sendFile(clientIndex);
  });
} else {
  app.get("/", (_req, res) => {
    res.send(
      "Nuggets server is running. Build the client with: cd client && npm run build",
    );
  });
}

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("game", GameRoom);

gameServer.listen(port).then(() => {
  console.log(`Colyseus server listening on ws://localhost:${port}`);
});
