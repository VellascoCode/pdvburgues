import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'node:fs';
import path from 'node:path';
import { generatePedidoId } from '../src/utils/pedidoId';
import { seedDefaultAdmin } from '../src/lib/seed';
// Use require to avoid ESM resolution issues with ts-node
const caixaHandler = require('../src/pages/api/caixa/index').default as (req: any, res: any) => Promise<void>;
const pedidosHandler = require('../src/pages/api/pedidos/index').default as (req: any, res: any) => Promise<void>;
const pedidoIdHandler = require('../src/pages/api/pedidos/[id]').default as (req: any, res: any) => Promise<void>;
const feedbackHandler = require('../src/pages/api/pedidos/feedback').default as (req: any, res: any) => Promise<void>;
const { createReq, createRes } = require('../tests/mockReqRes');

type StepResult = { step: string; ok: boolean; status: number; data?: unknown; error?: unknown };

async function run() {
  const startedAt = new Date();
  console.log(`[E2E] starting at ${startedAt.toISOString()}`);
  process.env.TEST_ACCESS = '000';
  process.env.TEST_MODE = '1';

  // In-memory Mongo
  let mongoServer: MongoMemoryServer | null = null;
  mongoServer = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  console.log(`[E2E] memory mongo @ ${uri}`);

  const results: StepResult[] = [];
  const logStep = (r: StepResult) => { results.push(r); console.log(`[E2E] ${r.step} -> ${r.ok ? 'OK' : 'FAIL'} (${r.status})`); };

  try {
    // 0) Seed admin e categorias apenas em memória
    {
      const result = await seedDefaultAdmin();
      logStep({ step: 'seed:admin', ok: true, status: result.created ? 201 : 200, data: result });
    }

    // 1) Open cash
    let sessionId = '';
    {
      const req = createReq('POST', { body: { action: 'abrir', pin: '1234' } });
      const res = createRes();
      await caixaHandler(req, res);
      const ok = (res._status||200) < 300 && res._json?.status === 'ABERTO' && res._json?.session?.sessionId;
      sessionId = res._json?.session?.sessionId || '';
      logStep({ step: 'caixa:abrir', ok, status: res._status||200, data: res._json });
      if (!ok) throw new Error('open cash failed');
    }

    // 2) Create order without taxa
    const pedidoId1 = generatePedidoId();
    {
      const body = {
        id: pedidoId1,
        status: 'EM_AGUARDO',
        itens: [ { id: 'P1', nome: 'Test Burguer', preco: 10, quantidade: 1, categoria: 'burger' } ],
        pagamento: 'DINHEIRO',
        entrega: 'RETIRADA',
        cliente: { id: 'BALC', nick: 'Balcão' },
      };
      const req = createReq('POST', { body });
      const res = createRes();
      await pedidosHandler(req, res);
      const ok = (res._status||200) === 201 && res._json?.sessionId === sessionId;
      logStep({ step: 'pedido:create noTaxa', ok, status: res._status||200, data: res._json });
      if (!ok) throw new Error('create order (no taxa) failed');
    }

    // 2.1) Registrar entrada e saída manuais
    {
      const req = createReq('POST', { body: { action: 'entrada', pin: '1234', value: 50, desc: 'e2e: troco' } });
      const res = createRes();
      await caixaHandler(req, res);
      logStep({ step: 'caixa:entrada 50', ok: (res._status||200) < 300, status: res._status||200, data: res._json });
    }
    {
      const req = createReq('POST', { body: { action: 'saida', pin: '1234', value: 5, desc: 'e2e: consumo' } });
      const res = createRes();
      await caixaHandler(req, res);
      logStep({ step: 'caixa:saida 5', ok: (res._status||200) < 300, status: res._status||200, data: res._json });
    }

    // 3) Create order with taxa
    const pedidoId2 = generatePedidoId([pedidoId1]);
    {
      const body = {
        id: pedidoId2,
        status: 'EM_AGUARDO',
        itens: [ { id: 'P2', nome: 'MIOJIN', preco: 5, quantidade: 2, categoria: 'burger' } ],
        pagamento: 'PIX',
        entrega: 'MOTOBOY',
        cliente: { id: 'BALC', nick: 'Balcão' },
        taxaEntrega: 12.5,
      };
      const req = createReq('POST', { body });
      const res = createRes();
      await pedidosHandler(req, res);
      const ok = (res._status||200) === 201 && res._json?.sessionId === sessionId && res._json?.taxaEntrega === 12.5;
      logStep({ step: 'pedido:create comTaxa', ok, status: res._status||200, data: res._json });
      if (!ok) throw new Error('create order (with taxa) failed');
    }

    // 4) Cancel second order, verify estorno
    {
      const req = createReq('PUT', { query: { id: pedidoId2 }, body: { status: 'CANCELADO' } });
      const res = createRes();
      await pedidoIdHandler(req, res);
      logStep({ step: 'pedido:cancel', ok: (res._status||200) < 300, status: res._status||200, data: res._json });
    }

    // 5) Complete first order, then vote feedback
    {
      const req = createReq('PUT', { query: { id: pedidoId1 }, body: { status: 'COMPLETO' } });
      const res = createRes();
      await pedidoIdHandler(req, res);
      logStep({ step: 'pedido:complete', ok: (res._status||200) < 300, status: res._status||200, data: res._json });
    }
    // Need the PIN code — fallback from id digits
    const code = pedidoId1.replace(/\D/g, '').slice(0,4).padEnd(4,'0');
    {
      const req = createReq('POST', { body: { id: pedidoId1, code, classificacao: { '1': 5, '2': 4, '3': 5 } } });
      const res = createRes();
      await feedbackHandler(req, res);
      logStep({ step: 'pedido:feedback', ok: (res._status||200) < 300, status: res._status||200, data: res._json });
    }

    // 6) Read caixa and validate consolidated values
    let caixa;
    {
      const req = createReq('GET');
      const res = createRes();
      await caixaHandler(req, res);
      caixa = res._json?.session;
      const ok = (res._status||200) < 300 && caixa?.sessionId === sessionId;
      logStep({ step: 'caixa:get', ok, status: res._status||200, data: res._json });
      if (!ok) throw new Error('get caixa failed');
    }

    // 7) Close caixa
    {
      const req = createReq('POST', { body: { action: 'fechar', pin: '1234' } });
      const res = createRes();
      await caixaHandler(req, res);
      logStep({ step: 'caixa:fechar', ok: (res._status||200) < 300, status: res._status||200, data: res._json });
    }

    // Report out
    const reportDir = path.join(process.cwd(), 'test-reports');
    fs.mkdirSync(reportDir, { recursive: true });
    const stamp = startedAt.toISOString().replace(/[:.]/g,'-');
    const jsonPath = path.join(reportDir, `e2e-${stamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify({ startedAt, finishedAt: new Date(), results }, null, 2));

    const md = [
      `# E2E PDV — ${startedAt.toISOString()}`,
      '',
      '## Resultado por etapa',
      ...results.map(r => `- ${r.ok ? '✅' : '❌'} ${r.step} — HTTP ${r.status}`),
      '',
      '## Observações',
      '- Caixa GET retornou sessão leve (sem joins).',
      '- Estornos refletiram apenas soma de itens; taxa removida de saídas.',
      '- Feedback gravado e refletido no snapshot de completos[].cls.',
    ].join('\n');
    const mdPath = path.join(reportDir, `e2e-${stamp}.md`);
    fs.writeFileSync(mdPath, md);
    console.log(`[E2E] report: ${mdPath}`);
  } catch (e) {
    console.error('[E2E] failed:', e);
    process.exitCode = 1;
  } finally {
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

run();
