import { MongoMemoryServer } from 'mongodb-memory-server';
import { createReq, createRes } from '@/tests/mockReqRes';

const handler = require('../src/pages/api/testesgeral').default as (req: any, res: any) => Promise<void>;

async function run() {
  console.log('[GERAL] iniciando teste geral isolado');
  let mongo: MongoMemoryServer | null = null;
  try {
    mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
    process.env.MONGODB_URI = mongo.getUri();
    process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'geral-secret';
    process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    process.env.TEST_ACCESS = '000';

    const req = createReq('GET', { query: { save: '1' } });
    const res = createRes();
    await handler(req, res);
    const ok = (res._status || 200) < 300;
    console.log(`[GERAL] finalizado com status ${res._status || 200}`);
    if (!ok) {
      console.error('[GERAL] falhou', res._json);
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('[GERAL] erro ao executar teste geral', err);
    process.exitCode = 1;
  } finally {
    if (mongo) await mongo.stop();
  }
}

run();
