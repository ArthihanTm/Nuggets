import { Client, Room } from "colyseus.js";

let currentRoom: Room | null = null;

/**
 * Which server to connect to. Override by opening the page with
 * ?server=ws://your-host:2567 — otherwise it defaults to a local
 * Colyseus server started with `npm run dev` in server/.
 */
function resolveServerUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const override = params.get("server");
  if (override) return override;

  if (window.location.hostname === "localhost") {
    return "ws://localhost:2567";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

export async function connect(name: string): Promise<Room> {
  const client = new Client(resolveServerUrl());
  const room = await client.joinOrCreate("game", { name });
  currentRoom = room;
  return room;
}

export function getRoom(): Room {
  if (!currentRoom) {
    throw new Error("Not connected to a room yet — call connect() first.");
  }
  return currentRoom;
}
