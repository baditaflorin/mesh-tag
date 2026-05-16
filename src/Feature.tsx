import { useEffect, useState } from "react";
import {
  QRExchange,
  makeScanPayload,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };
type Tag = { from: string; to: string; ts: number };
const NAME_KEY = (p: string) => `${p}:displayName`;

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
  const [name, setName] = useState(
    () => localStorage.getItem(NAME_KEY(config.storagePrefix)) ?? "",
  );
  const [, rerender] = useState(0);

  useEffect(() => {
    if (name) localStorage.setItem(NAME_KEY(config.storagePrefix), name);
  }, [name, config.storagePrefix]);

  useEffect(() => {
    const log = room.doc.getArray<Tag>("log");
    const state = room.doc.getMap<string>("state");
    const names = room.doc.getMap<string>("names");
    const cb = () => rerender((n) => n + 1);
    log.observe(cb);
    state.observe(cb);
    names.observe(cb);
    return () => {
      log.unobserve(cb);
      state.unobserve(cb);
      names.unobserve(cb);
    };
  }, [room]);

  const log = room.doc.getArray<Tag>("log");
  const state = room.doc.getMap<string>("state");
  const names = room.doc.getMap<string>("names");

  useEffect(() => {
    if (name.trim()) names.set(room.peerId, name.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, room.peerId]);

  const itPeerId = state.get("it") ?? null;
  const itName = itPeerId ? (names.get(itPeerId) ?? itPeerId.slice(0, 6)) : null;
  const amIIt = itPeerId === room.peerId;

  const startGame = () => {
    state.set("it", room.peerId);
    log.push([{ from: "", to: room.peerId, ts: Date.now() }]);
  };

  const tag = (otherId: string, otherName?: string) => {
    if (!amIIt || otherId === room.peerId) return;
    if (otherName) names.set(otherId, otherName);
    room.doc.transact(() => {
      state.set("it", otherId);
      log.push([{ from: room.peerId, to: otherId, ts: Date.now() }]);
    });
  };

  // Time-as-it per peer
  const tagLog = log.toArray();
  const timeAsIt = new Map<string, number>();
  for (let i = 0; i < tagLog.length; i++) {
    const t = tagLog[i]!;
    const nextTs = i + 1 < tagLog.length ? tagLog[i + 1]!.ts : Date.now();
    timeAsIt.set(t.to, (timeAsIt.get(t.to) ?? 0) + (nextTs - t.ts));
  }

  const myPayload = makeScanPayload(room.roomId, room.peerId, name.trim() || "anon");

  return (
    <div className="viral-screen">
      <header>
        <h1>tag</h1>
        <p className="viral-status">
          {itName ? `${itName} is IT` : "no one is it yet"} · {tagLog.length} tags ·{" "}
          {room.peerCount + 1} present
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
        onScan={(parsed) => tag(parsed.peerId, parsed.extra ?? undefined)}
      />

      <section>
        <h2 className="viral-section-title">time-as-it leaderboard</h2>
        {timeAsIt.size === 0 ? (
          <p className="viral-empty">no one has been it yet</p>
        ) : (
          <ol className="tag-board">
            {Array.from(timeAsIt.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([peerId, ms]) => (
                <li key={peerId} className={peerId === room.peerId ? "is-me" : ""}>
                  <strong>{names.get(peerId) ?? peerId.slice(0, 6)}</strong>
                  <span>{Math.round(ms / 1000)}s</span>
                </li>
              ))}
          </ol>
        )}
      </section>

      <section>
        <h2 className="viral-section-title">tag history</h2>
        {tagLog.length === 0 ? (
          <p className="viral-empty">none</p>
        ) : (
          <ul className="tag-feed">
            {tagLog
              .slice()
              .reverse()
              .slice(0, 12)
              .map((t, i) => (
                <li key={i}>
                  {t.from ? (
                    <>
                      <strong>{names.get(t.from) ?? t.from.slice(0, 6)}</strong> →{" "}
                    </>
                  ) : (
                    "★ "
                  )}
                  <strong>{names.get(t.to) ?? t.to.slice(0, 6)}</strong> is it
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
