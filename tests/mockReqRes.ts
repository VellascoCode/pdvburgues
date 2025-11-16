import type { NextApiRequest, NextApiResponse } from 'next';

export type MockRes<T = unknown> = NextApiResponse<T> & {
  _status?: number;
  _json?: T;
  _ended?: boolean;
  _headers: Record<string, string | number | string[]>;
};

type CreateReqOptions = {
  query?: Record<string, string | string[]>;
  body?: unknown;
  headers?: Record<string, string>;
};

function isReadonlyStringArray(value: string | number | readonly string[]): value is readonly string[] {
  return Array.isArray(value);
}

export function createReq(method: string, opts?: CreateReqOptions): NextApiRequest {
  return {
    method: method.toUpperCase(),
    query: { ...(opts?.query || {}) },
    body: opts?.body,
    headers: { ...(opts?.headers || {}) },
    socket: { remoteAddress: '127.0.0.1' },
  } as NextApiRequest;
}

export function createRes<T = unknown>(): MockRes<T> {
  const res: Partial<MockRes<T>> = {
    _status: 200,
    _json: undefined,
    _ended: false,
    _headers: {},
    setHeader(key: string, value: string | number | readonly string[]) {
      const k = String(key).toLowerCase();
      if (isReadonlyStringArray(value)) {
        res._headers![k] = [...value];
      } else {
        res._headers![k] = value;
      }
      return res as MockRes<T>;
    },
    getHeader(key: string) {
      const k = String(key).toLowerCase();
      return res._headers?.[k];
    },
    getHeaders() { return { ...(res._headers || {}) }; },
    status(code: number) { res._status = code; return res as MockRes<T>; },
    json(obj: T) { res._json = obj; res._ended = true; return res as MockRes<T>; },
    end() { res._ended = true; return res as MockRes<T>; },
  };
  return res as MockRes<T>;
}
