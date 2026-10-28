import handler from "vinext/server/app-router-entry";
import { handleVisits } from './visits.js';

interface Env {
  ASSETS: Fetcher;
  DB?: { prepare(query: string): any; batch(statements: any[]): Promise<any[]> };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (new URL(request.url).pathname === '/api/visits') return handleVisits(request, env.DB);
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
