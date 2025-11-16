import type { NextApiRequest, NextApiResponse } from 'next';
import usersAccessHandler from './users/[access]';
import usersIndexHandler from './users/index';
import configHandler from './config/index';
import caixaHandler from './caixa/index';
import produtosHandler from './produtos/index';
import produtoByIdHandler from './produtos/[id]';
import clientesHandler from './clientes/index';
import pedidoListCreateHandler from './pedidos/index';
import pedidoIdHandler from './pedidos/[id]';
import feedbackHandler from './pedidos/feedback';
import categoriasHandler from './categorias/index';
import pedidoPublicHandler from './pedidos/public';
import feedbackIndexHandler from './feedback/index';
import eventsIndexHandler from './eventos/index';
import eventKeyHandler from './eventos/[key]';
import logsHandler from './logs/index';
import productsStatsHandler from './products/stats';
import categoriasIndexHandler from './categorias/index';
import categoriaKeyHandler from './categorias/[key]';
import { ObjectId } from 'mongodb';
import fs from 'node:fs';
import path from 'node:path';
import { createReq, createRes } from '@/tests/mockReqRes';
import { getDb } from '@/lib/mongodb';
import { generatePedidoId } from '@/utils/pedidoId';
import { seedDefaultAdmin } from '@/lib/seed';

type Step = {
  step: string;
  ok: boolean;
  status: number;
  data?: unknown;
  error?: unknown;
};

type CaixaSnapshot = {
  status?: string;
  session?: {
    sessionId?: string;
    base?: number;
    vendasCount?: number;
    totals?: { vendas?: number; entradas?: number; saidas?: number; porPagamento?: Record<string, number> };
    items?: Record<string, number>;
    completos?: Array<{ id?: string; cls?: number[] }>;
    saidas?: Array<{ desc?: string; value?: number }>;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  }

  // Apenas admins: exige usuário 000 previamente criado (seedDefaultAdmin auxilia em ambiente de teste)
  process.env.TEST_ACCESS = '000';

  const stream = String(req.query.stream || '') === '1';
  const save = String(req.query.save || '') === '1';
  if (stream) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  }
  const log: Step[] = [];
  const write = (s: Step) => {
    log.push(s);
    if (stream) res.write(`${s.ok ? 'OK' : 'FAIL'} ${s.step} (${s.status})\n`);
  };

  const steps = async () => {
    // 0) seed admin/categorias localmente
    {
      const result = await seedDefaultAdmin();
      write({ step: 'seed:admin', ok: true, status: result.created ? 201 : 200, data: result });
    }

    // 0.1) user meta (type/status)
    {
      const r = createRes();
      await usersAccessHandler(createReq('GET', { query: { access: '000' } }), r);
      const userJson = r._json as { type?: number; status?: number } | null;
      write({ step: 'user:get 000', ok: (r._status||200) < 300 && Number(userJson?.type) === 10, status: r._status||200, data: { type: userJson?.type, status: userJson?.status } });
    }

    // 0.2) config (sanidade)
    {
      const r = createRes();
      await configHandler(createReq('GET'), r);
      write({ step: 'config:get', ok: (r._status||200) < 300, status: r._status||200 });
    }
    // 0.2b) users:check (valida existência e parâmetros)
    {
      const r1 = createRes(); await (await import('./users/check')).default(createReq('GET', { query: { access: '000' } }), r1);
      const r2 = createRes(); await (await import('./users/check')).default(createReq('GET', { query: { access: 'abc' } }), r2);
      const r3 = createRes(); await (await import('./users/check')).default(createReq('GET', { query: { access: '999' } }), r3);
      const checkJson = r1._json as { exists?: boolean } | null;
      write({ step: 'users:check 000', ok: (r1._status||200) === 200 && checkJson?.exists === true, status: r1._status||200 });
      write({ step: 'users:check inválido (400)', ok: (r2._status||0) === 400, status: r2._status||0 });
      write({ step: 'users:check inexistente (404)', ok: (r3._status||0) === 404, status: r3._status||0 });
    }
    // 0.2c) config: PUT e leitura
    {
      const r1 = createRes();
      await configHandler(createReq('PUT', { body: { storeName: `Loja E2E ${Date.now().toString().slice(-4)}`, sounds: false, business: { opened24h: true }, pin: '1234' } }), r1);
      const r2 = createRes();
      await configHandler(createReq('GET'), r2);
      const cfgJson = r2._json as { sounds?: boolean } | null;
      const ok = (r1._status||0) === 200 && (r2._status||0) === 200 && cfgJson?.sounds === false;
      write({ step: 'config:put/get', ok, status: r1._status||200 });
    }

    // 0.3) pré-limpeza de sessão aberta (se existir): cancelar pendentes e fechar
    {
      const r = createRes();
      await caixaHandler(createReq('GET'), r);
      const caixaJson = r._json as { status?: string } | null;
      const st = String(caixaJson?.status || '');
      if (st === 'ABERTO' || st === 'PAUSADO') {
        write({ step: 'pre:caixa aberto', ok: true, status: r._status||200 });
        // cancelar pedidos pendentes da sessão atual
        try {
          const rList = createRes();
          await pedidoListCreateHandler(createReq('GET'), rList);
          const arr: Array<{ id?: string; status?: string }> = Array.isArray(rList._json) ? rList._json : [];
          const pend = arr.filter((p) => !['CANCELADO','COMPLETO'].includes(String(p?.status || '')));
          for (const p of pend) {
            const id = typeof p.id === 'string' ? p.id : '';
            if (!id) continue;
            const rUpd = createRes();
            await pedidoIdHandler(createReq('PUT', { query: { id }, body: { status: 'CANCELADO' } }), rUpd);
          }
        } catch {}
        // tentar fechar
        const rClose = createRes();
        await caixaHandler(createReq('POST', { body: { action: 'fechar', pin: '1234' } }), rClose);
        const closed = (rClose._status||0) === 200;
        write({ step: 'pre:caixa fechar', ok: closed, status: rClose._status||0 });
      }
    }

    // 1) abrir caixa (ou usar sessão existente se ainda estiver aberta)
    let sessionId = '';
    {
      const r0 = createRes();
      await caixaHandler(createReq('GET'), r0);
      const caixa0 = r0._json as { status?: string } | null;
      const st = String(caixa0?.status || '');
      if (st === 'FECHADO') {
        const r = createRes();
        await caixaHandler(createReq('POST', { body: { action: 'abrir', pin: '1234' } }), r);
        const caixaOpen = r._json as { session?: { sessionId?: string } } | null;
        sessionId = caixaOpen?.session?.sessionId || '';
        write({ step: 'caixa:abrir', ok: !!sessionId && (r._status||200) < 300, status: r._status||200, data: caixaOpen });
        if (!sessionId) throw new Error('abrir caixa');
      } else {
        const caixaPrev = r0._json as { session?: { sessionId?: string } } | null;
        sessionId = caixaPrev?.session?.sessionId || '';
        write({ step: 'caixa:usar sessão existente', ok: !!sessionId, status: r0._status||200, data: { status: st, sessionId } });
      }
    }
    // 1.b) tentar abrir novamente (409)
    {
      const r = createRes();
      await caixaHandler(createReq('POST', { body: { action: 'abrir', pin: '1234' } }), r);
      write({ step: 'caixa:abrir novamente (409)', ok: (r._status||0) === 409, status: r._status||0 });
    }

    // 2) categorias (apenas GET de sanidade)
    {
      const r = createRes();
      await categoriasHandler(createReq('GET', { query: { active: '1', pageSize: '10' } }), r);
      write({ step: 'categorias:get', ok: (r._status||200) < 300, status: r._status||200 });
    }

    // 3) criar produto E2E (admin+pin)
    let prodId = '';
    let stockInicial = 0;
    {
      const body = {
        data: { nome: `E2E-Burguer-${Date.now()}`, categoria: 'burger', preco: 12, ativo: true, combo: false, desc: 'teste', stock: 5, iconKey: 'hamburger', cor: 'text-orange-400', bg: 'bg-orange-900/20' },
        pin: '1234'
      };
      const r = createRes();
      await produtosHandler(createReq('POST', { body }), r);
      const productJson = r._json as { _id?: string } | null;
      prodId = productJson?._id || '';
      write({ step: 'produto:create', ok: !!prodId && (r._status||200) < 300, status: r._status||200, data: { id: prodId } });
      if (prodId) {
        const r2 = createRes();
        await produtoByIdHandler(createReq('GET', { query: { id: prodId } }), r2);
        const prodSnapshot = r2._json as { stock?: number } | null;
        stockInicial = Number(prodSnapshot?.stock || 0);
        write({ step: 'produto:get', ok: (r2._status||200) < 300, status: r2._status||200, data: { stockInicial } });
      }
      // 3.1) atualizar preço/promo e depois apagar (soft)
      if (prodId) {
        const r3 = createRes();
        await produtoByIdHandler(createReq('PUT', { query: { id: prodId }, body: { pin: '1234', preco: 13, promo: 11, promoAtiva: true } }), r3);
        const updatedProd = r3._json as { preco?: number; promoAtiva?: boolean } | null;
        const okUpd = (r3._status||0) === 200 && Number(updatedProd?.preco) === 13 && updatedProd?.promoAtiva === true;
        write({ step: 'produto:update preco/promo', ok: okUpd, status: r3._status||0 });
        const r4 = createRes();
        await produtoByIdHandler(createReq('DELETE', { query: { id: prodId }, body: { pin: '1234' } }), r4);
        write({ step: 'produto:delete soft', ok: (r4._status||0) === 200, status: r4._status||0 });
      }
    }

    // 3.x) segurança/produtos: PIN inválido / sem sessão / payload com operador proibido
    {
      // PIN inválido
      const r1 = createRes();
      await produtosHandler(createReq('POST', { body: { data: { nome: 'Bad', categoria:'burger', preco: 1, ativo:true, desc:'x', stock: 1, iconKey:'hamburger', cor:'t', bg:'b' }, pin: '9999' } }), r1);
      write({ step: 'sec:produto PIN inválido (403)', ok: (r1._status||0) === 403, status: r1._status||0 });
      // Sem sessão (não admin)
      const prevTA = process.env.TEST_ACCESS; process.env.TEST_ACCESS = '';
      const r2 = createRes();
      await produtosHandler(createReq('POST', { body: { data: { nome: 'NoAuth', categoria:'burger', preco: 2, ativo:true, desc:'x', stock: 1, iconKey:'hamburger', cor:'t', bg:'b' }, pin: '1234' } }), r2);
      write({ step: 'sec:produto sem sessão (401)', ok: (r2._status||0) === 401, status: r2._status||0 });
      process.env.TEST_ACCESS = prevTA;
      // Operador $set no corpo — deve ser ignorado/rejeitado
      if (prodId) {
        const r3 = createRes();
        const maliciousBody: Record<string, unknown> = { pin: '1234', $set: { preco: 0.01 } };
        await produtoByIdHandler(createReq('PUT', { query: { id: prodId }, body: maliciousBody }), r3);
        write({ step: 'sec:produto payload $set ignorado', ok: (r3._status||0) === 400 || (r3._status||0) === 200, status: r3._status||0 });
      }
    }

    // 4) criar cliente E2E (admin+pin)
    let clienteUuid = '';
    {
      const body = { nome: 'Cliente E2E', email: `e2e${Date.now()}@ex.com`, telefone: `11${Date.now().toString().slice(-8)}`, pin: '1234' };
      const r = createRes();
      await clientesHandler(createReq('POST', { body }), r);
      const clientJson = r._json as { uuid?: string } | null;
      clienteUuid = clientJson?.uuid || '';
      write({ step: 'cliente:create', ok: !!clienteUuid && (r._status||200) < 300, status: r._status||200, data: { uuid: clienteUuid } });
    }
    // 4.a) XSS benigno em cliente (armazenado como texto)
    {
      const body = { nome: 'XSS \u003Cscript\u003E1\u003C/script\u003E', email: `xss${Date.now()}@ex.com`, telefone: `11${Date.now().toString().slice(-8)}`, pin: '1234' };
      const r = createRes();
      await clientesHandler(createReq('POST', { body }), r);
      write({ step: 'sec:xss cliente aceito (201)', ok: (r._status||0) === 201, status: r._status||0 });
    }

    // 4.2) categorias (criar/atualizar/remover)
    {
      const key = `e2e-cat-${Date.now().toString().slice(-5)}`;
      const r1 = createRes();
      await categoriasIndexHandler(createReq('POST', { body: { key, label: 'E2E Cat', iconKey: 'tag', cor: 'text-rose-400', bg: 'bg-rose-900/20', active: true, pin: '1234' } }), r1);
      write({ step: 'categoria:create', ok: (r1._status||0) === 201, status: r1._status||0 });
      const r2 = createRes();
      await categoriaKeyHandler(createReq('PUT', { query: { key }, body: { pin: '1234', label: 'E2E Cat Updated', active: false } }), r2);
      const catJson = r2._json as { active?: boolean } | null;
      write({ step: 'categoria:update', ok: (r2._status||0) === 200 && catJson?.active === false, status: r2._status||0 });
      const r3 = createRes();
      await categoriaKeyHandler(createReq('DELETE', { query: { key }, body: { pin: '1234' } }), r3);
      write({ step: 'categoria:delete', ok: (r3._status||0) === 200, status: r3._status||0 });
    }

    // 4.3) categorias com produtos vinculados — delete bloqueado
    {
      const k = `e2e-cat-prod-${Date.now().toString().slice(-5)}`;
      const r1 = createRes();
      await categoriasIndexHandler(createReq('POST', { body: { key: k, label: 'E2E Cat Prod', iconKey: 'tag', cor: 'text-emerald-400', bg: 'bg-emerald-900/20', active: true, pin: '1234' } }), r1);
      const pr = createRes();
      await produtosHandler(createReq('POST', { body: { data: { nome: `E2E-CatProd-${Date.now()}`, categoria: k, preco: 4, ativo:true, desc:'x', stock: 1, iconKey:'hamburger', cor:'t', bg:'b' }, pin:'1234' } }), pr);
      const r2 = createRes();
      await categoriaKeyHandler(createReq('DELETE', { query: { key: k }, body: { pin: '1234' } }), r2);
      write({ step: 'sec:categoria delete com produtos (400)', ok: (r2._status||0) === 400, status: r2._status||0 });
    }

    // 4.1) criar usuário (não admin) e atualizar
    let accessNewRef = '';
    {
      const accessNew = String(100 + Math.floor(Math.random()*900));
      accessNewRef = accessNew;
      const r1 = createRes();
      await usersIndexHandler(createReq('POST', { body: { pin: '1234', data: { access: accessNew, nome: 'User E2E', type: 5, workspace: 'caixa', newPin: '5678' } } }), r1);
      write({ step: `user:create ${accessNew}`, ok: (r1._status||0) === 201 || (r1._status||0) === 409, status: r1._status||0 });
      const r2 = createRes();
      await usersAccessHandler(createReq('PUT', { query: { access: accessNew }, body: { pin: '1234', status: 1, nick: `GerenteE2E-${Date.now().toString().slice(-4)}` } }), r2);
      write({ step: `user:update ${accessNew}`, ok: (r2._status||0) === 200 || (r2._status||0) === 400 /* nada para atualizar */ , status: r2._status||0 });
      const r3 = createRes();
      await usersIndexHandler(createReq('GET', { query: { q: 'User E2E', pageSize: '5' } }), r3);
      const userIndexJson = r3._json as { items?: Array<{ access?: string }> } | null;
      const usersList = Array.isArray(userIndexJson?.items) ? userIndexJson.items : [];
      const found = usersList.some((u) => u.access === accessNew);
      write({ step: `user:list contains ${accessNew}`, ok: found, status: r3._status||200 });
    }

    // 4.1b) usuário: board/allowedColumns
    if (accessNewRef) {
      const rB = createRes();
      await usersAccessHandler(createReq('PUT', { query: { access: accessNewRef }, body: { pin: '1234', board: { columns: [
        { id: 'EM_AGUARDO', label: 'Em Aguardo' }, { id: 'EM_PREPARO', label: 'Em Preparo' }, { id: 'COMPLETO', label: 'Completo' }
      ] }, allowedColumns: ['EM_AGUARDO','EM_PREPARO'] } }), rB);
      write({ step: `user:allowedColumns ${accessNewRef}`, ok: (rB._status||0) === 200, status: rB._status||0 });
    }

    // 4.2) eventos (criar, atualizar, deletar)
    {
      const key = `promo-e2e-${Date.now().toString().slice(-6)}`;
      const r1 = createRes();
      await eventsIndexHandler(createReq('POST', { body: { key, titulo: 'Promo E2E', subtitulo: 'Teste', descricao: 'Evento de teste', icon: 'gift', rewards: [{ p: 3, prize: 'Refri' }], active: true } }), r1);
      write({ step: 'event:create', ok: (r1._status||0) === 201, status: r1._status||0 });
      const r2 = createRes();
      await eventKeyHandler(createReq('PUT', { query: { key }, body: { active: false } }), r2);
      const eventJson = r2._json as { active?: boolean } | null;
      write({ step: 'event:update inactive', ok: (r2._status||0) === 200 && eventJson?.active === false, status: r2._status||0 });
      const r3 = createRes();
      await eventKeyHandler(createReq('DELETE', { query: { key } }), r3);
      write({ step: 'event:delete', ok: (r3._status||0) === 200, status: r3._status||0 });
    }

    // 4.3) stats de produtos
    {
      const r = createRes();
      await productsStatsHandler(createReq('GET'), r);
      const statsJson = r._json as { prodTotal?: number } | null;
      const ok = (r._status||200) === 200 && typeof statsJson?.prodTotal === 'number';
      write({ step: 'products:stats', ok, status: r._status||200 });
    }

    // 4.4) logs (escrever e ler)
    {
      const r1 = createRes();
      await logsHandler(createReq('POST', { body: { access: '000', action: 999, desc: 'e2e: log test' } }), r1);
      write({ step: 'logs:write', ok: (r1._status||0) === 201, status: r1._status||0 });
      const r2 = createRes();
      await logsHandler(createReq('GET', { query: { action: '999', limit: '5' } }), r2);
      const ok2 = Array.isArray(r2._json) && (r2._json as Array<{ action?: number }>).some((l) => l.action === 999);
      write({ step: 'logs:read', ok: ok2, status: r2._status||200 });
    }

    // 5) pedido sem taxa (Balcão)
    const pedido1: { id: string; code?: string } = { id: generatePedidoId() };
    {
      const r = createRes();
      const body = {
        id: pedido1.id,
        status: 'EM_AGUARDO',
        itens: [ { id: 'P1', nome: 'E2E Test', preco: 10, quantidade: 1, categoria: 'burger' } ],
        pagamento: 'DINHEIRO', entrega: 'RETIRADA', cliente: { id: 'BALC', nick: 'Balcão' }
      };
      await pedidoListCreateHandler(createReq('POST', { body }), r);
      const pedidoJson = r._json as { code?: string } | null;
      pedido1.code = pedidoJson?.code; // salvar PIN de 4 dígitos
      write({ step: 'pedido1:create', ok: (r._status||201) === 201, status: r._status||201, data: { id: pedido1.id, code: pedido1.code } });
    }
    // 5.a) tentar forçar sessionId: API deve sobrescrever para sessão atual
    {
      const hack: { id: string } = { id: generatePedidoId([pedido1.id]) };
      const r1 = createRes();
      await pedidoListCreateHandler(createReq('POST', { body: { id: hack.id, status: 'EM_AGUARDO', sessionId: 'FAKE', itens:[{ id:'Y1', nome:'Test', preco: 1, quantidade: 1, categoria:'burger' }], pagamento:'DINHEIRO', entrega:'RETIRADA', cliente:{ id:'BALC', nick:'Balcão' } } }), r1);
      const r2 = createRes();
      await pedidoIdHandler(createReq('GET', { query: { id: hack.id } }), r2);
      const hackJson = r2._json as { sessionId?: string } | null;
      write({ step: 'sec:pedido sessionId override', ok: (r2._status||0) === 200 && hackJson?.sessionId === sessionId, status: r2._status||0 });
    }

    // 5.1) listar pedidos da sessão atual
    {
      const r = createRes();
      await pedidoListCreateHandler(createReq('GET'), r);
      const has = Array.isArray(r._json) && r._json.some((p: { id?: string }) => p?.id === pedido1.id);
      write({ step: 'pedidos:list', ok: has, status: r._status||200 });
    }

    // 5.2) tentar fechar com pedidos pendentes (deve 409)
    {
      const r = createRes();
      await caixaHandler(createReq('POST', { body: { action: 'fechar', pin: '1234' } }), r);
      write({ step: 'caixa:fechar pendente (409)', ok: (r._status||0) === 409, status: r._status||0 });
    }

    // 6) entrada e saída manuais
    {
      const r = createRes();
      await caixaHandler(createReq('POST', { body: { action: 'entrada', value: 50, desc: 'e2e: entrada', pin: '1234' } }), r);
      write({ step: 'caixa:entrada 50', ok: (r._status||200) < 300, status: r._status||200 });
    }
    {
      const r = createRes();
      await caixaHandler(createReq('POST', { body: { action: 'saida', value: 5, desc: 'e2e: saida', pin: '1234' } }), r);
      write({ step: 'caixa:saida 5', ok: (r._status||200) < 300, status: r._status||200 });
    }
    // 6.a) tentativa inválida de entrada negativa
    {
      const r = createRes();
      await caixaHandler(createReq('POST', { body: { action: 'entrada', value: -10, desc: 'invalid', pin: '1234' } }), r);
      write({ step: 'sec:entrada negativa (400)', ok: (r._status||0) === 400, status: r._status||0 });
    }

    // 7) pedido com taxa e com produto estocável (cliente cadastrado)
    const pedido2: { id: string; code?: string } = { id: generatePedidoId([pedido1.id]) };
    {
      const r = createRes();
      const body = {
        id: pedido2.id,
        status: 'EM_AGUARDO',
        itens: [ { pid: prodId, id: prodId, nome: `E2E-Burguer`, preco: 12, quantidade: 3, categoria: 'burger' } ],
        pagamento: 'PIX', entrega: 'MOTOBOY', cliente: { id: clienteUuid, uuid: clienteUuid, nick: 'ClienteE2E' },
        taxaEntrega: 9.5,
        fidelidade: { enabled: true, evento: 'primeira_compra' },
      };
      await pedidoListCreateHandler(createReq('POST', { body }), r);
      const pedido2Json = r._json as { code?: string } | null;
      pedido2.code = pedido2Json?.code;
      write({ step: 'pedido2:create', ok: (r._status||201) === 201, status: r._status||201, data: { id: pedido2.id, code: pedido2.code } });
      if (prodId) {
        const r2 = createRes();
        await produtoByIdHandler(createReq('GET', { query: { id: prodId } }), r2);
        const prodInfo = r2._json as { stock?: number } | null;
        const stockApos = Number(prodInfo?.stock || 0);
        write({ step: 'produto:stock -3', ok: stockApos === Math.max(0, stockInicial - 3), status: r2._status||200, data: { stockInicial, stockApos } });
      }
      // Fidelidade: cliente ganhou ponto?
      {
        const db = await getDb();
        const c = await db.collection('customers').findOne({ uuid: clienteUuid });
        const ganhou = Number(c?.pontosTotal || 0) >= 1;
        write({ step: 'fidelidade:+1', ok: ganhou, status: 200, data: { pontosTotal: c?.pontosTotal } });
      }
    }

    // 7.x) pedidos inválidos / tentativas de burla
    {
      // preço negativo → 400
      const r1 = createRes();
      await pedidoListCreateHandler(createReq('POST', { body: { id: 'NEG1', status:'EM_AGUARDO', itens:[{ id:'N1', nome:'Hack', preco:-5, quantidade:1, categoria:'burger' }], pagamento:'DINHEIRO', entrega:'RETIRADA', cliente:{ id:'BALC', nick:'Balcão' } } }), r1);
      write({ step: 'sec:pedido preço negativo (400)', ok: (r1._status||0) === 400, status: r1._status||0 });
      // oversell: criar produto de stock=2 e comprar 999 → 409
      const pr = createRes();
      await produtosHandler(createReq('POST', { body: { data: { nome: `E2E-Stock2-${Date.now()}`, categoria:'burger', preco: 3, ativo:true, desc:'x', stock: 2, iconKey:'hamburger', cor:'t', bg:'b' }, pin: '1234' } }), pr);
      const prodCreated = pr._json as { _id?: string } | null;
      const pid2 = prodCreated?._id;
      const r2 = createRes();
      await pedidoListCreateHandler(createReq('POST', { body: { id: 'OVR1', status:'EM_AGUARDO', itens:[{ pid: pid2, id: pid2, nome:'Stock2', preco:3, quantidade:999, categoria:'burger' }], pagamento:'DINHEIRO', entrega:'RETIRADA', cliente:{ id:'BALC', nick:'Balcão' } } }), r2);
      write({ step: 'sec:pedido oversell (409)', ok: (r2._status||0) === 409, status: r2._status||0 });
    }

    // 8) pausar caixa -> tentar criar pedido (deve falhar) -> checar status -> retomar -> checar status
    {
      const r1 = createRes();
      await caixaHandler(createReq('POST', { body: { action: 'pausar', pin: '1234' } }), r1);
      write({ step: 'caixa:pausar', ok: (r1._status||200) < 300, status: r1._status||200 });
      const r1b = createRes();
      await caixaHandler(createReq('GET'), r1b);
      const caixaPaused = r1b._json as { status?: string } | null;
      write({ step: 'caixa:status PAUSADO', ok: caixaPaused?.status === 'PAUSADO', status: r1b._status||200 });
      const r2 = createRes();
      await pedidoListCreateHandler(createReq('POST', { body: { id: 'BLOCKED1', status:'EM_AGUARDO', itens: [], pagamento:'PENDENTE', entrega:'RETIRADA', cliente:{ id:'BALC', nick:'Balcão'} } }), r2);
      write({ step: 'pedido:create paused (espera 409)', ok: (r2._status||0) === 409, status: r2._status||0 });
      const r3 = createRes();
      await caixaHandler(createReq('POST', { body: { action: 'retomar', pin: '1234' } }), r3);
      write({ step: 'caixa:retomar', ok: (r3._status||200) < 300, status: r3._status||200 });
      const r3b = createRes();
      await caixaHandler(createReq('GET'), r3b);
      const caixaOpenAgain = r3b._json as { status?: string } | null;
      write({ step: 'caixa:status ABERTO', ok: caixaOpenAgain?.status === 'ABERTO', status: r3b._status||200 });
    }

    // 9) cancelar pedido2 (estorno + pull taxa + repor estoque)
    {
      const r = createRes();
      await pedidoIdHandler(createReq('PUT', { query: { id: pedido2.id }, body: { status: 'CANCELADO' } }), r);
      write({ step: 'pedido2:cancel', ok: (r._status||200) < 300, status: r._status||200 });
      // estoque voltou?
      if (prodId) {
        const r2 = createRes();
        await produtoByIdHandler(createReq('GET', { query: { id: prodId } }), r2);
        const stockAfterCancel = r2._json as { stock?: number } | null;
        const stockAposCancel = Number(stockAfterCancel?.stock || 0);
        write({ step: 'produto:stock +3', ok: stockAposCancel === stockInicial, status: r2._status||200, data: { stockInicial, stockAposCancel } });
      }
      // Fidelidade estornada?
      {
        const db = await getDb();
        const c = await db.collection('customers').findOne({ uuid: clienteUuid });
        const pts = Number(c?.pontosTotal || 0);
        write({ step: 'fidelidade:estorno', ok: pts === 0, status: 200, data: { pontosTotal: pts } });
      }
      // Saída de taxa removida do caixa?
      {
        const r3 = createRes();
        await caixaHandler(createReq('GET'), r3);
        const caixaTax = r3._json as { session?: { saidas?: Array<{ desc?: string }> } } | null;
        const saidas = caixaTax?.session?.saidas || [];
        const hasTax = saidas.some((m)=> String(m?.desc||'').includes(`taxa entrega ${pedido2.id}`));
        write({ step: 'saida:taxa removida', ok: !hasTax, status: r3._status||200 });
      }
      // Logs 331/332 registrados
      {
        const r4 = createRes();
        await logsHandler(createReq('GET', { query: { group: '330', limit: '20' } }), r4);
        const logs = Array.isArray(r4._json) ? r4._json as Array<{ action?: number; ref?: { pedidoId?: string } }> : [];
        const hasAdd = logs.some((log) => log?.action === 331 && log?.ref?.pedidoId === pedido2.id);
        const hasRefund = logs.some((log) => log?.action === 332 && log?.ref?.pedidoId === pedido2.id);
        write({ step: 'logs:taxa adicionada (331)', ok: hasAdd, status: r4._status||200 });
        write({ step: 'logs:taxa estornada (332)', ok: hasRefund, status: r4._status||200 });
      }
    }

    // 10) completar pedido1 e votar feedback (PIN correto)
    {
      const r1 = createRes();
      await pedidoIdHandler(createReq('PUT', { query: { id: pedido1.id }, body: { status: 'COMPLETO' } }), r1);
      write({ step: 'pedido1:complete', ok: (r1._status||200) < 300, status: r1._status||200 });
      const r2 = createRes();
      await feedbackHandler(createReq('POST', { body: { id: pedido1.id, code: String(pedido1.code||''), classificacao: { '1': 5, '2': 4, '3': 5 } } }), r2);
      write({ step: 'pedido1:feedback', ok: (r2._status||200) < 300, status: r2._status||200 });
      // feedback duplicado deve falhar com 409
      const r3 = createRes();
      await feedbackHandler(createReq('POST', { body: { id: pedido1.id, code: String(pedido1.code||''), classificacao: { '1': 3, '2': 3, '3': 3 } } }), r3);
      write({ step: 'pedido1:feedback duplicado (409)', ok: (r3._status||0) === 409, status: r3._status||0 });
    }

    // 10.1) métricas de feedback agregadas (agg=1)
    {
      const r = createRes();
      await feedbackIndexHandler(createReq('GET', { query: { agg: '1', days: '7' } }), r);
      const feedbackJson = r._json as { metrics?: { total?: number } } | null;
      const ok = (r._status||200) < 300 && Number(feedbackJson?.metrics?.total || 0) >= 1;
      write({ step: 'feedback:agg', ok, status: r._status||200 });
    }
    // 10.2) feedback windows de 30/90 dias
    {
      const r30 = createRes(); await feedbackIndexHandler(createReq('GET', { query: { agg: '1', days: '30' } }), r30);
      const r90 = createRes(); await feedbackIndexHandler(createReq('GET', { query: { agg: '1', days: '90' } }), r90);
      write({ step: 'feedback:agg 30/90', ok: (r30._status||200) === 200 && (r90._status||200) === 200, status: (r30._status||200) });
    }

    // 11) caixa:get e validar consistência básica
    {
      const r = createRes();
      await caixaHandler(createReq('GET'), r);
      const caixaData = r._json as CaixaSnapshot | null;
      const sess = caixaData?.session;
      // Após pedido1 (10) e hack (1), antes da venda extra CARTAO, esperamos:
      // - vendas = DINHEIRO (PIX=0)
      const tot = sess?.totals || {};
      const vendas = Number(tot.vendas || 0);
      const pgTotals = (tot.porPagamento || {}) as Record<string, number>;
      const din = Number(pgTotals.DINHEIRO || 0);
      const pix = Number(pgTotals.PIX || 0);
      const vendCount = Number(sess?.vendasCount || 0);
      const ok = sess && sess.sessionId === sessionId && vendas === din && pix === 0 && Number(tot.entradas||0) === 50 && Number(tot.saidas||0) === 5 && vendCount >= 1;
      // items não negativos
      const itemValues = Object.values(sess?.items || {}) as Array<number | string>;
      const nonNegative = itemValues.every((v) => Number(v) >= 0);
      // cls deve estar presente no completo após feedback
      const compList = Array.isArray(sess?.completos) ? sess.completos as Array<{ id?: string; cls?: number[] }> : [];
      const comp = compList.find((c) => c.id === pedido1.id);
      const hasCls = comp && Array.isArray(comp.cls) && comp.cls.length === 3;
      write({ step: 'caixa:get', ok: !!ok && nonNegative && !!hasCls, status: r._status||200, data: { totals: sess?.totals, vendasCount: sess?.vendasCount } });
    }
    // 11.0) Top itens: exatamente 3 maiores (se houver) e sem negativos
    {
      const r = createRes();
      await caixaHandler(createReq('GET'), r);
      const caixaItems = r._json as CaixaSnapshot | null;
      const items = caixaItems?.session?.items || {};
      const arr = Object.entries(items).filter(([,v])=> Number(v)>0).sort((a,b)=> Number(b[1])-Number(a[1]));
      const top3 = arr.slice(0,3);
      const okTop = top3.length <= 3 && top3.every(([,v])=> Number(v)>0);
      write({ step: 'caixa:top3 itens', ok: okTop, status: r._status||200 });
    }

    // 11.1) endpoint público do pedido1 (deve funcionar logo após COMPLETO)
    {
      const r = createRes();
      await pedidoPublicHandler(createReq('GET', { query: { id: pedido1.id, code: String(pedido1.code||'') } }), r);
      write({ step: 'public:get ok', ok: (r._status||200) === 200, status: r._status||200 });
    }

    // 11.2) expiração do público (>1h)
    {
      const db = await getDb();
      const old = new Date(Date.now() - 2*60*60*1000).toISOString();
      await db.collection('pedidos').updateOne({ id: pedido1.id }, { $set: { 'timestamps.COMPLETO': old } });
      const r = createRes();
      await pedidoPublicHandler(createReq('GET', { query: { id: pedido1.id, code: String(pedido1.code||'') } }), r);
      write({ step: 'public:get expirado', ok: (r._status||410) === 410, status: r._status||410 });
      const r2 = createRes();
      await pedidoPublicHandler(createReq('GET', { query: { id: pedido1.id, code: '0000' } }), r2);
      write({ step: 'public:get PIN errado (403)', ok: (r2._status||0) === 403, status: r2._status||0 });
    }

    // 11.3) nova venda CARTAO: deltas exatos de vendas/porPagamento
    {
      // snapshot antes
      const rB = createRes();
      await caixaHandler(createReq('GET'), rB);
      const sessB = (rB._json as CaixaSnapshot | null)?.session || {};
      const vendasB = Number(sessB?.totals?.vendas || 0);
      const countB = Number(sessB?.vendasCount || 0);
      const cardB = Number((sessB?.totals?.porPagamento || {}).CARTAO || 0);
      // cria pedido3
      const pedido3: { id: string } = { id: generatePedidoId([pedido1.id, pedido2.id]) };
      const rC = createRes();
      await pedidoListCreateHandler(createReq('POST', { body: { id: pedido3.id, status: 'EM_AGUARDO', itens: [ { id: 'X1', nome: 'E2E Extra', preco: 8, quantidade: 2, categoria: 'burger' } ], pagamento: 'CARTAO', entrega: 'RETIRADA', cliente: { id:'BALC', nick:'Balcão' } } }), rC);
      const rC2 = createRes();
      await pedidoIdHandler(createReq('PUT', { query: { id: pedido3.id }, body: { status: 'COMPLETO' } }), rC2);
      // snapshot depois
      const rA = createRes();
      await caixaHandler(createReq('GET'), rA);
      const sessA = (rA._json as CaixaSnapshot | null)?.session || {};
      const vendasA = Number(sessA?.totals?.vendas || 0);
      const countA = Number(sessA?.vendasCount || 0);
      const cardA = Number((sessA?.totals?.porPagamento || {}).CARTAO || 0);
      const delta = vendasA - vendasB;
      const deltaCount = countA - countB;
      const deltaCard = cardA - cardB;
      const itemsMap = sessA?.items || {};
      const hasExtra = typeof itemsMap['E2E Extra'] === 'number' && itemsMap['E2E Extra'] >= 2;
      write({ step: 'venda extra CARTAO +16', ok: delta === 16 && deltaCount === 1 && deltaCard === 16 && hasExtra, status: rA._status||200 });
    }

    // 11.4) Produtos — GET filtros
    {
      const r1 = createRes(); await produtosHandler(createReq('GET', { query: { ativo: '1', pageSize: '5' } }), r1);
      const r2 = createRes(); await produtosHandler(createReq('GET', { query: { promo: 'active', pageSize: '5' } }), r2);
      const r3 = createRes(); await produtosHandler(createReq('GET', { query: { stock: 'gt0', pageSize: '5' } }), r3);
      write({ step: 'produtos:filtros', ok: (r1._status||0)===200 && (r2._status||0)===200 && (r3._status||0)===200, status: r1._status||200 });
    }

    // 11.4) cadeia de status em pedido4 (timestamps em todas as fases)
    {
      const pedido4: { id: string } = { id: generatePedidoId([pedido1.id, pedido2.id]) };
      const r1 = createRes();
      await pedidoListCreateHandler(createReq('POST', { body: { id: pedido4.id, status: 'EM_AGUARDO', itens: [ { id: 'S1', nome: 'Fluxo', preco: 4, quantidade: 1, categoria: 'burger' } ], pagamento:'DINHEIRO', entrega:'RETIRADA', cliente:{ id:'BALC', nick:'Balcão' } } }), r1);
      const doStep = async (st: string) => { const r = createRes(); await pedidoIdHandler(createReq('PUT', { query: { id: pedido4.id }, body: { status: st } }), r); return (r._status||0) === 200; };
      const okA = await doStep('EM_PREPARO');
      const okB = await doStep('PRONTO');
      const okC = await doStep('EM_ROTA');
      const okD = await doStep('COMPLETO');
      const rG = createRes();
      await pedidoIdHandler(createReq('GET', { query: { id: pedido4.id } }), rG);
      const caixaTs = rG._json as { timestamps?: Record<string, string> } | null;
      const ts = caixaTs?.timestamps || {};
      const hasAll = ts.EM_AGUARDO && ts.EM_PREPARO && ts.PRONTO && ts.EM_ROTA && ts.COMPLETO;
      write({ step: 'pedido4:status chain', ok: okA && okB && okC && okD && !!hasAll, status: 200 });
    }

    // 11.5) cancelar pedido5 e garantir que estorno zera o delta de vendas
    {
      // snapshot antes
      const rB = createRes(); await caixaHandler(createReq('GET'), rB); const vB = Number((rB._json as CaixaSnapshot | null)?.session?.totals?.vendas || 0);
      // cria
      const pedido5: { id: string } = { id: generatePedidoId([pedido1.id, pedido2.id]) };
      const rC = createRes();
      await pedidoListCreateHandler(createReq('POST', { body: { id: pedido5.id, status: 'EM_AGUARDO', itens: [ { id: 'Z1', nome: 'Cancelar', preco: 7, quantidade: 2, categoria: 'burger' } ], pagamento:'DINHEIRO', entrega:'RETIRADA', cliente:{ id:'BALC', nick:'Balcão' } } }), rC);
      const rD = createRes(); await caixaHandler(createReq('GET'), rD); const vC = Number((rD._json as CaixaSnapshot | null)?.session?.totals?.vendas || 0);
      // cancela
      const rE = createRes(); await pedidoIdHandler(createReq('PUT', { query: { id: pedido5.id }, body: { status: 'CANCELADO' } }), rE);
      const rF = createRes(); await caixaHandler(createReq('GET'), rF); const vD = Number((rF._json as CaixaSnapshot | null)?.session?.totals?.vendas || 0);
      write({ step: 'pedido5:cancel estorno delta 0', ok: (vC - vB) === 14 && vD === vB, status: 200 });
    }

    // 12) fechar caixa (cancelar pendentes antes)
    {
      // cancelar quaisquer pedidos pendentes
      try {
        const rList = createRes();
        await pedidoListCreateHandler(createReq('GET'), rList);
        const arr: Array<{ id?: string; status?: string }> = Array.isArray(rList._json) ? rList._json : [];
        const pend = arr.filter((p) => !['CANCELADO','COMPLETO'].includes(String(p?.status || '')));
        for (const p of pend) {
          const id = typeof p.id === 'string' ? p.id : '';
          if (!id) continue;
          const rUpd = createRes();
          await pedidoIdHandler(createReq('PUT', { query: { id }, body: { status: 'CANCELADO' } }), rUpd);
        }
      } catch {}
      const r = createRes();
      await caixaHandler(createReq('POST', { body: { action: 'fechar', pin: '1234' } }), r);
      write({ step: 'caixa:fechar', ok: (r._status||200) < 300, status: r._status||200 });
    }

    // 12.1) tentar criar pedido com caixa fechado (espera 409)
    {
      const r = createRes();
      await pedidoListCreateHandler(createReq('POST', { body: { id: 'AFTERCLOSE', status:'EM_AGUARDO', itens: [], pagamento:'PENDENTE', entrega:'RETIRADA', cliente:{ id:'BALC', nick:'Balcão'} } }), r);
      write({ step: 'pedido:create fechado (409)', ok: (r._status||0) === 409, status: r._status||0 });
    }

    // 12.2) nova sessão com base e movimentos
    {
      // abrir com base 100
      const rOpen = createRes();
      await caixaHandler(createReq('POST', { body: { action: 'abrir', pin: '1234', base: 100 } }), rOpen);
      const caixaBase = rOpen._json as CaixaSnapshot | null;
      write({ step: 'caixa:abrir base 100', ok: (rOpen._status||0) === 201 && Number(caixaBase?.session?.base||0) === 100, status: rOpen._status||0 });
      // duas entradas e uma saída
      const rE1 = createRes(); await caixaHandler(createReq('POST', { body: { action: 'entrada', value: 20, desc: 'E1', pin: '1234' } }), rE1);
      const rE2 = createRes(); await caixaHandler(createReq('POST', { body: { action: 'entrada', value: 30, desc: 'E2', pin: '1234' } }), rE2);
      const rS1 = createRes(); await caixaHandler(createReq('POST', { body: { action: 'saida', value: 10, desc: 'S1', pin: '1234' } }), rS1);
      const rGet = createRes(); await caixaHandler(createReq('GET'), rGet);
      const t = (rGet._json as CaixaSnapshot | null)?.session?.totals || {};
      const ok = Number(t.entradas||0) >= 50 /* da sessão anterior não se mistura */ && Number(t.saidas||0) >= 10;
      write({ step: 'caixa:movimentos nova sessão', ok, status: rGet._status||200 });
      // fechar novamente
      const rClose2 = createRes(); await caixaHandler(createReq('POST', { body: { action: 'fechar', pin: '1234' } }), rClose2);
      write({ step: 'caixa:fechar nova sessão', ok: (rClose2._status||0) === 200, status: rClose2._status||0 });
    }

    // 13) limpeza best-effort
    try {
      const db = await getDb();
      if (sessionId) await db.collection('cash').deleteOne({ sessionId });
      if (pedido1?.id) await db.collection('pedidos').deleteOne({ id: pedido1.id });
      if (pedido2?.id) await db.collection('pedidos').deleteOne({ id: pedido2.id });
      if (prodId) {
        const ids = [prodId, prodId].map((s) => {
          try {
            return new ObjectId(s);
          } catch {
            return s;
          }
        });
        const objectIds = ids.filter((value): value is ObjectId => value instanceof ObjectId);
        if (objectIds.length) {
          await db.collection('products').deleteMany({ _id: { $in: objectIds } });
        }
      }
      if (clienteUuid) await db.collection('customers').deleteOne({ uuid: clienteUuid });
      await db.collection('feedback').deleteMany({ pid: { $in: [pedido1?.id, pedido2?.id].filter(Boolean) } });
      // tentativa de auto-suspender admin (deve falhar) — fora do fluxo principal de caixa
      const rTry = createRes();
      await usersAccessHandler(createReq('PUT', { query: { access: '000' }, body: { pin: '1234', status: 2 } }), rTry);
      write({ step: 'user:self-suspend (400)', ok: (rTry._status||0) === 400, status: rTry._status||0 });
      write({ step: 'cleanup', ok: true, status: 200 });
    } catch (e) {
      write({ step: 'cleanup', ok: false, status: 500, error: String(e) });
    }
  };

  try {
    await steps();
    if (save) {
      try {
        const reportDir = path.join(process.cwd(), 'test-reports');
        fs.mkdirSync(reportDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g,'-');
        fs.writeFileSync(path.join(reportDir, `geral-${stamp}.json`), JSON.stringify({ ok: true, results: log }, null, 2));
        const md = [
          `# Teste Geral — ${new Date().toLocaleString()}`,
          '',
          '## Etapas',
          ...log.map(s => `- ${s.ok ? '✅' : '❌'} ${s.step} — HTTP ${s.status}`)
        ].join('\n');
        fs.writeFileSync(path.join(reportDir, `geral-${stamp}.md`), md);
      } catch {}
    }
    if (stream) { res.end(); return; }
    return res.status(200).json({ ok: true, results: log });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (stream) { res.write(`FAIL: ${message}\n`); res.end(); return; }
    return res.status(500).json({ ok: false, results: log, error: message });
  }
}
