import {
  QRExchange,
  Leaderboard,
  makeScanPayload,
  useEventLog,
  useNamedPeer,
  type MeshConfig,
  type YRoom,
  type LeaderboardItem,
} from "@baditaflorin/mesh-common";
import { useEffect, useState } from "react";

type Props = { room: YRoom | null; config: MeshConfig };
type TagEvt = { peerId: string; from: string; to: string; ts: number };

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="viral-screen">
        <h1>tag</h1>
        <p className="viral-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  // primitives #1 + #3 + nameOf for the leaderboard
  const { name, setName, nameOf } = useNamedPeer(config, room);
  const log = useEventLog<TagEvt>(room, "log");
  const [, rerender] = useState(0);

  useEffect(() => {
    const state = room.doc.getMap<string>("state");
    const cb = () => rerender((n) => n + 1);
    state.observe(cb);
    return () => state.unobserve(cb);
  }, [room]);

  const state = room.doc.getMap<string>("state");
  const itPeerId = state.get("it") ?? null;
  const itName = itPeerId ? (nameOf(itPeerId) ?? itPeerId.slice(0, 6)) : null;
  const amIIt = itPeerId === room.peerId;

  const startGame = () => {
    state.set("it", room.peerId);
    log.push({ peerId: room.peerId, from: "", to: room.peerId, ts: Date.now() });
  };

  const tag = (otherId: string) => {
    if (!amIIt || otherId === room.peerId) return;
    room.doc.transact(() => {
      state.set("it", otherId);
      log.push({ peerId: room.peerId, from: room.peerId, to: otherId, ts: Date.now() });
    });
  };

  // Compute time-as-it from the event log
  const timeAsIt = new Map<string, number>();
  const events = log.events;
  for (let i = 0; i < events.length; i++) {
    const t = events[i]!;
    const nextTs = i + 1 < events.length ? events[i + 1]!.ts : Date.now();
    timeAsIt.set(t.to, (timeAsIt.get(t.to) ?? 0) + (nextTs - t.ts));
  }

  const board: LeaderboardItem[] = Array.from(timeAsIt.entries())
    .map(([peerId, ms]) => ({
      id: peerId,
      name: nameOf(peerId) ?? peerId.slice(0, 6),
      score: Math.round(ms / 1000),
    }))
    .sort((a, b) => b.score - a.score);

  const myPayload = makeScanPayload(room.roomId, room.peerId, name.trim() || "anon");

  return (
    <div className="viral-screen">
      <header>
        <h1>tag</h1>
        <p className="viral-status">
          {itName ? `${itName} is IT` : "no one is it yet"} · {log.size} tags · {room.peerCount + 1}{" "}
          present
        </p>
      </header>

      <input
        className="viral-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="your name"
        maxLength={48}
      />

      {!itPeerId ? (
        <button type="button" className="viral-primary" onClick={startGame} disabled={!name.trim()}>
          start — I'm it
        </button>
      ) : amIIt ? (
        <div className="tag-banner is-it">YOU ARE IT — scan someone to pass it</div>
      ) : (
        <div className="tag-banner">{itName} is it · run!</div>
      )}

      <QRExchange
        myPayload={myPayload}
        showLabel="your QR"
        scanLabel={amIIt ? "scan to tag" : "you can only tag when you are it"}
        onScan={(parsed) => tag(parsed.peerId)}
      />

      <Leaderboard
        title="time-as-it leaderboard"
        items={board}
        highlightId={room.peerId}
        emptyText="no one has been it yet"
        formatScore={(s) => `${s}s`}
      />

      <section>
        <h2 className="viral-section-title">tag history</h2>
        {log.size === 0 ? (
          <p className="viral-empty">none</p>
        ) : (
          <ul className="tag-feed">
            {log.latest(12).map((t, i) => (
              <li key={i}>
                {t.from ? (
                  <>
                    <strong>{nameOf(t.from) ?? t.from.slice(0, 6)}</strong> →{" "}
                  </>
                ) : (
                  "★ "
                )}
                <strong>{nameOf(t.to) ?? t.to.slice(0, 6)}</strong> is it
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
