import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { promises as fs } from "fs";
import path from "path";
import type { Session, SessionResponse } from "./types";

/**
 * Storage backend.
 * - On Cloudflare Workers: D1 (binding `DB`, schema in ./migrations).
 * - Locally (`next dev`): a JSON file in ./data.
 */
interface Store {
  listSessions(): Promise<Session[]>;
  getSession(id: string): Promise<Session | null>;
  getSessionIdByCode(code: string): Promise<string | null>;
  saveSession(session: Session): Promise<void>;
  deleteSession(id: string): Promise<void>;
  markStarted(sessionId: string, participantId: string): Promise<void>;
  countStarted(sessionId: string): Promise<number>;
  /** Returns false when this participant already submitted (submissions are immutable). */
  addResponse(sessionId: string, response: SessionResponse): Promise<boolean>;
  listResponses(sessionId: string): Promise<SessionResponse[]>;
  countResponses(sessionId: string): Promise<number>;
  clearResponses(sessionId: string): Promise<void>;
}

/** The subset of Cloudflare's D1 API we use (avoids pulling in workers-types). */
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
interface D1Database {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
}

function createD1Store(db: D1Database): Store {
  const count = async (sql: string, id: string) =>
    (await db.prepare(sql).bind(id).first<{ n: number }>())?.n ?? 0;
  return {
    async listSessions() {
      const { results } = await db.prepare("SELECT data FROM sessions").all<{ data: string }>();
      return results.map((r) => JSON.parse(r.data) as Session);
    },
    async getSession(id) {
      const row = await db.prepare("SELECT data FROM sessions WHERE id = ?").bind(id).first<{ data: string }>();
      return row ? (JSON.parse(row.data) as Session) : null;
    },
    async getSessionIdByCode(code) {
      const row = await db.prepare("SELECT id FROM sessions WHERE code = ?").bind(code).first<{ id: string }>();
      return row?.id ?? null;
    },
    async saveSession(session) {
      await db
        .prepare(
          "INSERT INTO sessions (id, code, data) VALUES (?, ?, ?) " +
            "ON CONFLICT(id) DO UPDATE SET code = excluded.code, data = excluded.data",
        )
        .bind(session.id, session.code, JSON.stringify(session))
        .run();
    },
    async deleteSession(id) {
      await db.batch([
        db.prepare("DELETE FROM sessions WHERE id = ?").bind(id),
        db.prepare("DELETE FROM responses WHERE session_id = ?").bind(id),
        db.prepare("DELETE FROM starts WHERE session_id = ?").bind(id),
      ]);
    },
    async markStarted(sessionId, participantId) {
      await db
        .prepare("INSERT OR IGNORE INTO starts (session_id, participant_id) VALUES (?, ?)")
        .bind(sessionId, participantId)
        .run();
    },
    countStarted(sessionId) {
      // Union with responses so submissions without a recorded start still count.
      return count(
        "SELECT COUNT(*) AS n FROM (SELECT participant_id FROM starts WHERE session_id = ?1 " +
          "UNION SELECT participant_id FROM responses WHERE session_id = ?1)",
        sessionId,
      );
    },
    async addResponse(sessionId, response) {
      // The primary key makes retries and concurrent duplicates no-ops.
      const res = await db
        .prepare(
          "INSERT OR IGNORE INTO responses (session_id, participant_id, created_at, answers) VALUES (?, ?, ?, ?)",
        )
        .bind(sessionId, response.id, response.createdAt, JSON.stringify(response.answers))
        .run();
      return res.meta.changes > 0;
    },
    async listResponses(sessionId) {
      const { results } = await db
        .prepare(
          "SELECT participant_id, created_at, answers FROM responses WHERE session_id = ? ORDER BY created_at",
        )
        .bind(sessionId)
        .all<{ participant_id: string; created_at: number; answers: string }>();
      return results.map((r) => ({ id: r.participant_id, createdAt: r.created_at, answers: JSON.parse(r.answers) }));
    },
    countResponses(sessionId) {
      return count("SELECT COUNT(*) AS n FROM responses WHERE session_id = ?", sessionId);
    },
    async clearResponses(sessionId) {
      await db.batch([
        db.prepare("DELETE FROM responses WHERE session_id = ?").bind(sessionId),
        db.prepare("DELETE FROM starts WHERE session_id = ?").bind(sessionId),
      ]);
    },
  };
}

type FileDb = {
  sessions: Record<string, Session>;
  responses: Record<string, SessionResponse[]>;
  started?: Record<string, string[]>;
};

function createFileStore(): Store {
  const file = path.join(process.cwd(), "data", "db.json");
  // Serialize all writes so concurrent submissions don't clobber each other.
  let queue: Promise<unknown> = Promise.resolve();

  async function read(): Promise<FileDb> {
    try {
      return JSON.parse(await fs.readFile(file, "utf8")) as FileDb;
    } catch {
      return { sessions: {}, responses: {} };
    }
  }
  function mutate(fn: (db: FileDb) => void): Promise<void> {
    const next = queue.then(async () => {
      const db = await read();
      fn(db);
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(db, null, 2));
      await fs.rename(tmp, file);
    });
    queue = next.catch(() => {});
    return next;
  }

  return {
    async listSessions() {
      return Object.values((await read()).sessions);
    },
    async getSession(id) {
      return (await read()).sessions[id] ?? null;
    },
    async getSessionIdByCode(code) {
      const s = Object.values((await read()).sessions).find((x) => x.code === code);
      return s?.id ?? null;
    },
    saveSession(session) {
      return mutate((db) => {
        db.sessions[session.id] = session;
      });
    },
    deleteSession(id) {
      return mutate((db) => {
        delete db.sessions[id];
        delete db.responses[id];
        delete db.started?.[id];
      });
    },
    markStarted(sessionId, participantId) {
      return mutate((db) => {
        const list = ((db.started ??= {})[sessionId] ??= []);
        if (!list.includes(participantId)) list.push(participantId);
      });
    },
    async countStarted(sessionId) {
      const db = await read();
      const ids = new Set([
        ...(db.started?.[sessionId] ?? []),
        ...(db.responses[sessionId] ?? []).map((r) => r.id),
      ]);
      return ids.size;
    },
    async addResponse(sessionId, response) {
      let added = false;
      await mutate((db) => {
        const list = (db.responses[sessionId] ??= []);
        if (list.some((r) => r.id === response.id)) return;
        list.push(response);
        added = true;
      });
      return added;
    },
    async listResponses(sessionId) {
      return (await read()).responses[sessionId] ?? [];
    },
    async countResponses(sessionId) {
      return ((await read()).responses[sessionId] ?? []).length;
    },
    clearResponses(sessionId) {
      return mutate((db) => {
        delete db.responses[sessionId];
        delete db.started?.[sessionId];
      });
    },
  };
}

let fileStore: Store | null = null;

/** Resolved per call: the Cloudflare context only exists inside a request on Workers. */
function backend(): Store {
  try {
    const db = (getCloudflareContext().env as unknown as { DB?: D1Database }).DB;
    if (db) return createD1Store(db);
  } catch {
    // Not running on Cloudflare (e.g. `next dev`).
  }
  return (fileStore ??= createFileStore());
}

export function storeKind(): "d1" | "file" {
  try {
    return (getCloudflareContext().env as unknown as { DB?: unknown }).DB ? "d1" : "file";
  } catch {
    return "file";
  }
}

export const store: Store = {
  listSessions: () => backend().listSessions(),
  getSession: (id) => backend().getSession(id),
  getSessionIdByCode: (code) => backend().getSessionIdByCode(code),
  saveSession: (s) => backend().saveSession(s),
  deleteSession: (id) => backend().deleteSession(id),
  markStarted: (sid, pid) => backend().markStarted(sid, pid),
  countStarted: (sid) => backend().countStarted(sid),
  addResponse: (sid, r) => backend().addResponse(sid, r),
  listResponses: (sid) => backend().listResponses(sid),
  countResponses: (sid) => backend().countResponses(sid),
  clearResponses: (sid) => backend().clearResponses(sid),
};
