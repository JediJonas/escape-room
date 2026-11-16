/**
 * Vilka mobiler som är med i ett testrum och vilka som håller fingret på
 * skärmen. Rena funktioner utan nät och klocka: tiden skickas in.
 */

/** En mobil som har varit tyst så här länge räknas som borta. */
export const PEER_TIMEOUT_MS = 6000;

export type PeerMessage = { id: string; name: string; isHolding: boolean };

type Peer = { id: string; name: string; isHolding: boolean; lastSeenAt: number; holdChangedAt: number };

type Room = Map<string, Peer>;

export function createRoom(): Room {
  return new Map();
}

/**
 * För in ett meddelande från en mobil i rummet.
 * @param receivedAt när meddelandet kom fram hit, i ms
 */
export function applyPeerMessage(room: Room, message: PeerMessage, receivedAt: number) {
  const known = room.get(message.id);
  const hasHoldChanged = !known || known.isHolding !== message.isHolding;
  room.set(message.id, {
    id: message.id,
    name: message.name,
    isHolding: message.isHolding,
    lastSeenAt: receivedAt,
    holdChangedAt: hasHoldChanged ? receivedAt : known.holdChangedAt,
  });
}

/**
 * Tar bort mobiler som har slutat höras av.
 */
export function dropSilentPeers(room: Room, now: number) {
  for (const [id, peer] of room) {
    if (now - peer.lastSeenAt > PEER_TIMEOUT_MS) room.delete(id);
  }
}

/**
 * pressSpreadMs är tiden mellan första och sista trycket bland dem som håller,
 * så som det kom fram till den här mobilen.
 */
export function summarizeRoom(room: Room): { peers: Peer[]; isEveryoneHolding: boolean; pressSpreadMs: number | null } {
  const peers = [...room.values()].sort((a, b) => a.name.localeCompare(b.name, 'sv') || a.id.localeCompare(b.id));
  const holding = peers.filter((peer) => peer.isHolding);
  // En ensam mobil kan inte visa att tryck synkas, så det krävs minst två.
  const isEveryoneHolding = peers.length >= 2 && holding.length === peers.length;
  const pressTimes = holding.map((peer) => peer.holdChangedAt);
  const pressSpreadMs = holding.length >= 2 ? Math.max(...pressTimes) - Math.min(...pressTimes) : null;
  return { peers, isEveryoneHolding, pressSpreadMs };
}
