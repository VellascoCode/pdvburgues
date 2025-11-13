import type { NextApiRequest, NextApiResponse } from 'next';

export type MockRes = NextApiResponse & {
  _status?: number;
  _json?: any;
  _ended?: boolean;
  _headers: Record<string, string>;
};

export function createReq(method: string, opts?: { query?: Record<string, any>; body?: any; headers?: Record<string, string> }): NextApiRequest {
  return {
    method: method.toUpperCase(),
    query: { ...(opts?.query || {}) } as any,
    body: opts?.body,
    headers: { ...(opts?.headers || {}) } as any,
    socket: { remoteAddress: '127.0.0.1' } as any,
  } as unknown as NextApiRequest;
}

export function createRes(): MockRes {
  const res: Partial<MockRes> = {
    _status: 200,
    _json: undefined,
    _ended: false,
    _headers: {},
    setHeader(key: string, value: any) {
      const k = String(key).toLowerCase();
      (res._headers as any)[k] = value;
      return undefined as any;
    },
    getHeader(key: string) {
      const k = String(key).toLowerCase();
      return (res._headers as any)[k];
    },
    getHeaders() { return { ...(res._headers as any) }; },
    status(code: number) { res._status = code; return res as any; },
    json(obj: any) { res._json = obj; res._ended = true; return undefined as any; },
    end() { res._ended = true; return undefined as any; },
  };
  return res as MockRes;
}
