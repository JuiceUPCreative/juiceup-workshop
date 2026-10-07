import "server-only";
import { Redis } from "@upstash/redis";
import { promises as fs } from "fs";
import path from "path";
import type { Session, SessionResponse } from "./types";

/**
 * Storage backend.
 * - On Vercel: Upstash Redis (added via Vercel Marketplace, env vars are injected automatically).
 * - Locally without those env vars: a JSON file in ./data.
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

const redisUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

const PREFIX = "jw:";
const K_SESSIONS = `${PREFIX}sessions`;
const K_CODES = `${PREFIX}codes`;
const kResponses = (id: string) => `${PREFIX}responses:${id}`;
const kStarted = (id: string) => `${PREFIX}started:${id}`;
const kSubmitted = (id: string) => `${PREFIX}submitted:${id}`;

function createRedisStore(redis: Redis): Store {
  const parse = <T>(v: unknown): T => (typeof v === "string" ? JSON.parse(v) : v) as T;
  return {
    async listSessions() {
      const all = await redis.hgetall<Record<string, string>>(K_SESSIONS);
      return all ? Object.values(all).map((v) => parse<Session>(v)) : [];
    },
    async getSession(id) {
      const v = await redis.hget<string>(K_SESSIONS, id);
      return v ? parse<Session>(v) : null;
    },
    async getSessionIdByCode(code) {
      return (await redis.hget<string>(K_CODES, code)) ?? null;
    },
    async saveSession(session) {
      await redis
        .pipeline()
        .hset(K_SESSIONS, { [session.id]: JSON.stringify(session) })
        .hset(K_CODES, { [session.code]: session.id })
        .exec();
    },
    async deleteSession(id) {
      const s = await this.getSession(id);
      const p = redis
        .pipeline()
        .hdel(K_SESSIONS, id)
        .del(kResponses(id), kStarted(id), kSubmitted(id));
      if (s) p.hdel(K_CODES, s.code);
      await p.exec();
    },
    async markStarted(sessionId, participantId) {
      await redis.sadd(kStarted(sessionId), participantId);
    },
    async countStarted(sessionId) {
      return redis.scard(kStarted(sessionId));
    },
    async addResponse(sessionId, response) {
      // SADD is atomic, so concurrent retries of the same participant store one response.
      const isNew = await redis.sadd(kSubmitted(sessionId), response.id);
      if (!isNew) return false;
      await redis
        .pipeline()
        .sadd(kStarted(sessionId), response.id)
        .rpush(kResponses(sessionId), JSON.stringify(response))
        .exec();
      return true;
    },
    async listResponses(sessionId) {
      const items = await redis.lrange<string>(kResponses(sessionId), 0, -1);
      return items.map((v) => parse<SessionResponse>(v));
    },
    async countResponses(sessionId) {
      return redis.llen(kResponses(sessionId));
    },
    async clearResponses(sessionId) {
      await redis.del(kResponses(sessionId), kStarted(sessionId), kSubmitted(sessionId));
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

export const storeKind: "redis" | "file" = redisUrl && redisToken ? "redis" : "file";

export const store: Store =
  storeKind === "redis"
    ? createRedisStore(
        new Redis({ url: redisUrl!, token: redisToken!, automaticDeserialization: false }),
      )
    : createFileStore();
