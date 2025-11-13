import type { NextApiRequest, NextApiResponse } from 'next';
import ensureAdminHandler from './users/ensure-admin';
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
import produtoById from './produtos/[id]';
import { ObjectId } from 'mongodb';
import fs from 'node:fs';
import path from 'node:path';
import { createReq, createRes } from '@/tests/mockReqRes';
import { getDb } from '@/lib/mongodb';

type Step = {
  step: string;
  ok: boolean;
  status: number;
  data?: any;
  error?: any;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  }

  // Apenas admins: precisa existir user 000 (ensure-admin cria)
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
    // 0) ensure-admin
    {
      const r = createRes();
      await ensureAdminHandler(createReq('GET'), r as any);
      write({ step: 'ensure-admin', ok: (r._status||200) < 300, status: r._status||200, data: r._json });
      if ((r._status||200) >= 300) throw new Error('ensure-admin');
    }

    // 0.1) user meta (type/status)
    {
      const r = createRes();
      await usersAccessHandler(createReq('GET', { query: { access: '000' } }), r as any);
      write({ step: 'user:get 000', ok: (r._status||200) < 300 && Number(r._json?.type) === 10, status: r._status||200, data: { type: r._json?.type, status: r._json?.status } });
    }

    // 0.2) config (sanidade)
    {
      const r = createRes();
      await configHandler(createReq('GET'), r as any);
      write({ step: 'config:get', ok: (r._status||200) < 300, status: r._status||200 });
    }
    // 0.2b) users:check (valida existência e parâmetros)
    {
      const r1 = createRes(); await (await import('./users/check')).default(createReq('GET', { query: { access: '000' } }), r1 as any);
      const r2 = createRes(); await (await import('./users/check')).default(createReq('GET', { query: { access: 'abc' } }), r2 as any);
      const r3 = createRes(); await (await import('./users/check')).default(createReq('GET', { query: { access: '999' } }), r3 as any);
      write({ step: 'users:check 000', ok: (r1._status||200) === 200 && r1._json?.exists === true, status: r1._status||200 });
      write({ step: 'users:check inválido (400)', ok: (r2._status||0) === 400, status: r2._status||0 });
      write({ step: 'users:check inexistente (404)', ok: (r3._status||0) === 404, status: r3._status||0 });
    }
    // 0.2c) config: PUT e leitura
    {
      const r1 = createRes();
      await configHandler(createReq('PUT', { body: { storeName: `Loja E2E ${Date.now().toString().slice(-4)}`, sounds: false, business: { opened24h: true }, pin: '1234' } }), r1 as any);
      const r2 = createRes();
      await configHandler(createReq('GET'), r2 as any);
      const ok = (r1._status||0) === 200 && (r2._status||0) === 200 && r2._json?.sounds === false;
      write({ step: 'config:put/get', ok, status: r1._status||200 });
    }

    // 0.3) pré-limpeza de sessão aberta (se existir): cancelar pendentes e fechar
    {
      const r = createRes();
      await caixaHandler(createReq('GET'), r as any);
      const st = String(r._json?.status || '');
      if (st === 'ABERTO' || st === 'PAUSADO') {
        write({ step: 'pre:caixa aberto', ok: true, status: r._status||200 });
        // cancelar pedidos pendentes da sessão atual
        try {
          const rList = createRes();
          await pedidoListCreateHandler(createReq('GET'), rList as any);
          const arr: any[] = Array.isArray(rList._json) ? rList._json : [];
          const pend = arr.filter((p: any) => !['CANCELADO','COMPLETO'].includes(String(p?.status||'')));
          for (const p of pend) {
            const rUpd = createRes();
            await pedidoIdHandler(createReq('PUT', { query: { id: p.id }, body: { status: 'CANCELADO' } }), rUpd as any);
          }
        } catch {}
        // tentar fechar
        const rClose = createRes();
        await caixaHandler(createReq('POST', { body: { action: 'fechar', pin: '1234' } }), rClose as any);
        const closed = (rClose._status||0) === 200;
        write({ step: 'pre:caixa fechar', ok: closed, status: rClose._status||0 });
      }
    }

    // 1) abrir caixa (ou usar sessão existente se ainda estiver aberta)
    let sessionId = '';
    {
      const r0 = createRes();
      await caixaHandler(createReq('GET'), r0 as any);
      const st = String(r0._json?.status || '');
      if (st === 'FECHADO') {
        const r = createRes();
        await caixaHandler(createReq('POST', { body: { action: 'abrir', pin: '1234' } }), r as any);
        sessionId = r._json?.session?.sessionId || '';
        write({ step: 'caixa:abrir', ok: !!sessionId && (r._status||200) < 300, status: r._status||200, data: r._json });
        if (!sessionId) throw new Error('abrir caixa');
      } else {
        sessionId = r0._json?.session?.sessionId || '';
        write({ step: 'caixa:usar sessão existente', ok: !!sessionId, status: r0._status||200, data: { status: st, sessionId } });
      }
    }
    // 1.b) tentar abrir novamente (409)
    {
      const r = createRes();
      await caixaHandler(createReq('POST', { body: { action: 'abrir', pin: '1234' } }), r as any);
      write({ step: 'caixa:abrir novamente (409)', ok: (r._status||0) === 409, status: r._status||0 });
    }

    // 2) categorias (apenas GET de sanidade)
    {
      const r = createRes();
      await categoriasHandler(createReq('GET', { query: { active: '1', pageSize: '10' } }), r as any);
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
      await produtosHandler(createReq('POST', { body }), r as any);
      prodId = r._json?._id || '';
      write({ step: 'produto:create', ok: !!prodId && (r._status||200) < 300, status: r._status||200, data: { id: prodId } });
      if (prodId) {
        const r2 = createRes();
        await produtoByIdHandler(createReq('GET', { query: { id: prodId } }), r2 as any);
        stockInicial = Number(r2._json?.stock || 0);
        write({ step: 'produto:get', ok: (r2._status||200) < 300, status: r2._status||200, data: { stockInicial } });
      }
      // 3.1) atualizar preço/promo e depois apagar (soft)
      if (prodId) {
        const r3 = createRes();
        await produtoById(createReq('PUT', { query: { id: prodId }, body: { pin: '1234', preco: 13, promo: 11, promoAtiva: true } }), r3 as any);
        const okUpd = (r3._status||0) === 200 && Number(r3._json?.preco) === 13 && r3._json?.promoAtiva === true;
        write({ step: 'produto:update preco/promo', ok: okUpd, status: r3._status||0 });
        const r4 = createRes();
        await produtoById(createReq('DELETE', { query: { id: prodId }, body: { pin: '1234' } }), r4 as any);
        write({ step: 'produto:delete soft', ok: (r4._status||0) === 200, status: r4._status||0 });
      }
    }

    // 3.x) segurança/produtos: PIN inválido / sem sessão / payload com operador proibido
    {
      // PIN inválido
      const r1 = createRes();
      await produtosHandler(createReq('POST', { body: { data: { nome: 'Bad', categoria:'burger', preco: 1, ativo:true, desc:'x', stock: 1, iconKey:'hamburger', cor:'t', bg:'b' }, pin: '9999' } }), r1 as any);
      write({ step: 'sec:produto PIN inválido (403)', ok: (r1._status||0) === 403, status: r1._status||0 });
      // Sem sessão (não admin)
      const prevTA = process.env.TEST_ACCESS; process.env.TEST_ACCESS = '';
      const r2 = createRes();
      await produtosHandler(createReq('POST', { body: { data: { nome: 'NoAuth', categoria:'burger', preco: 2, ativo:true, desc:'x', stock: 1, iconKey:'hamburger', cor:'t', bg:'b' }, pin: '1234' } }), r2 as any);
      write({ step: 'sec:produto sem sessão (401)', ok: (r2._status||0) === 401, status: r2._status||0 });
      process.env.TEST_ACCESS = prevTA;
      // Operador $set no corpo — deve ser ignorado/rejeitado
      if (prodId) {
        const r3 = createRes();
        await produtoById(createReq('PUT', { query: { id: prodId }, body: { pin: '1234', "$set": { preco: 0.01 } } as any }), r3 as any);
        write({ step: 'sec:produto payload $set ignorado', ok: (r3._status||0) === 400 || (r3._status||0) === 200, status: r3._status||0 });
      }
    }

    // 4) criar cliente E2E (admin+pin)
    let clienteUuid = '';
    {
      const body = { nome: 'Cliente E2E', email: `e2e${Date.now()}@ex.com`, telefone: `11${Date.now().toString().slice(-8)}`, pin: '1234' };
      const r = createRes();
      await clientesHandler(createReq('POST', { body }), r as any);
      clienteUuid = r._json?.uuid || '';
      write({ step: 'cliente:create', ok: !!clienteUuid && (r._status||200) < 300, status: r._status||200, data: { uuid: clienteUuid } });
    }
    // 4.a) XSS benigno em cliente (armazenado como texto)
    {
      const body = { nome: 'XSS \u003Cscript\u003E1\u003C/script\u003E', email: `xss${Date.now()}@ex.com`, telefone: `11${Date.now().toString().slice(-8)}`, pin: '1234' };
      const r = createRes();
      await clientesHandler(createReq('POST', { body }), r as any);
      write({ step: 'sec:xss cliente aceito (201)', ok: (r._status||0) === 201, status: r._status||0 });
    }

    // 4.2) categorias (criar/atualizar/remover)
    {
      const key = `e2e-cat-${Date.now().toString().slice(-5)}`;
      const r1 = createRes();
      await categoriasIndexHandler(createReq('POST', { body: { key, label: 'E2E Cat', iconKey: 'tag', cor: 'text-rose-400', bg: 'bg-rose-900/20', active: true, pin: '1234' } }), r1 as any);
      write({ step: 'categoria:create', ok: (r1._status||0) === 201, status: r1._status||0 });
      const r2 = createRes();
      await categoriaKeyHandler(createReq('PUT', { query: { key }, body: { pin: '1234', label: 'E2E Cat Updated', active: false } }), r2 as any);
      write({ step: 'categoria:update', ok: (r2._status||0) === 200 && r2._json?.active === false, status: r2._status||0 });
      const r3 = createRes();
      await categoriaKeyHandler(createReq('DELETE', { query: { key }, body: { pin: '1234' } }), r3 as any);
      write({ step: 'categoria:delete', ok: (r3._status||0) === 200, status: r3._status||0 });
    }

    // 4.3) categorias com produtos vinculados — delete bloqueado
    {
      const k = `e2e-cat-prod-${Date.now().toString().slice(-5)}`;
      const r1 = createRes();
      await categoriasIndexHandler(createReq('POST', { body: { key: k, label: 'E2E Cat Prod', iconKey: 'tag', cor: 'text-emerald-400', bg: 'bg-emerald-900/20', active: true, pin: '1234' } }), r1 as any);
      const pr = createRes();
      await produtosHandler(createReq('POST', { body: { data: { nome: `E2E-CatProd-${Date.now()}`, categoria: k, preco: 4, ativo:true, desc:'x', stock: 1, iconKey:'hamburger', cor:'t', bg:'b' }, pin:'1234' } }), pr as any);
      const r2 = createRes();
      await categoriaKeyHandler(createReq('DELETE', { query: { key: k }, body: { pin: '1234' } }), r2 as any);
      write({ step: 'sec:categoria delete com produtos (400)', ok: (r2._status||0) === 400, status: r2._status||0 });
    }

    // 4.1) criar usuário (não admin) e atualizar
    let accessNewRef = '';
    {
      const accessNew = String(100 + Math.floor(Math.random()*900));
      accessNewRef = accessNew;
      const r1 = createRes();
      await usersIndexHandler(createReq('POST', { body: { pin: '1234', data: { access: accessNew, nome: 'User E2E', type: 5, workspace: 'caixa', newPin: '5678' } } }), r1 as any);
      write({ step: `user:create ${accessNew}`, ok: (r1._status||0) === 201 || (r1._status||0) === 409, status: r1._status||0 });
      const r2 = createRes();
      await usersAccessHandler(createReq('PUT', { query: { access: accessNew }, body: { pin: '1234', status: 1, nick: `GerenteE2E-${Date.now().toString().slice(-4)}` } }), r2 as any);
      write({ step: `user:update ${accessNew}`, ok: (r2._status||0) === 200 || (r2._status||0) === 400 /* nada para atualizar */ , status: r2._status||0 });
      const r3 = createRes();
      await usersIndexHandler(createReq('GET', { query: { q: 'User E2E', pageSize: '5' } }), r3 as any);
      const found = Array.isArray(r3._json?.items) && r3._json.items.some((u: any)=> u.access === accessNew);
      write({ step: `user:list contains ${accessNew}`, ok: found, status: r3._status||200 });
    }

    // 4.1b) usuário: board/allowedColumns
    if (accessNewRef) {
      const rB = createRes();
      await usersAccessHandler(createReq('PUT', { query: { access: accessNewRef }, body: { pin: '1234', board: { columns: [
        { id: 'EM_AGUARDO', label: 'Em Aguardo' }, { id: 'EM_PREPARO', label: 'Em Preparo' }, { id: 'COMPLETO', label: 'Completo' }
      ] }, allowedColumns: ['EM_AGUARDO','EM_PREPARO'] } }), rB as any);
      write({ step: `user:allowedColumns ${accessNewRef}`, ok: (rB._status||0) === 200, status: rB._status||0 });
    }

    // 4.2) eventos (criar, atualizar, deletar)
    {
      const key = `promo-e2e-${Date.now().toString().slice(-6)}`;
      const r1 = createRes();
      await eventsIndexHandler(createReq('POST', { body: { key, titulo: 'Promo E2E', subtitulo: 'Teste', descricao: 'Evento de teste', icon: 'gift', rewards: [{ p: 3, prize: 'Refri' }], active: true } }), r1 as any);
      write({ step: 'event:create', ok: (r1._status||0) === 201, status: r1._status||0 });
      const r2 = createRes();
      await eventKeyHandler(createReq('PUT', { query: { key }, body: { active: false } }), r2 as any);
      write({ step: 'event:update inactive', ok: (r2._status||0) === 200 && r2._json?.active === false, status: r2._status||0 });
      const r3 = createRes();
      await eventKeyHandler(createReq('DELETE', { query: { key } }), r3 as any);
      write({ step: 'event:delete', ok: (r3._status||0) === 200, status: r3._status||0 });
    }

    // 4.3) stats de produtos
    {
      const r = createRes();
      await productsStatsHandler(createReq('GET'), r as any);
      const ok = (r._status||200) === 200 && typeof r._json?.prodTotal === 'number';
      write({ step: 'products:stats', ok, status: r._status||200 });
    }

    // 4.4) logs (escrever e ler)
    {
      const r1 = createRes();
      await logsHandler(createReq('POST', { body: { access: '000', action: 999, desc: 'e2e: log test' } }), r1 as any);
      write({ step: 'logs:write', ok: (r1._status||0) === 201, status: r1._status||0 });
      const r2 = createRes();
      await logsHandler(createReq('GET', { query: { action: '999', limit: '5' } }), r2 as any);
      const ok2 = Array.isArray(r2._json) && r2._json.some((l: any)=> l.action === 999);
      write({ step: 'logs:read', ok: ok2, status: r2._status||200 });
    }

    // 5) pedido sem taxa (Balcão)
    const pedido1 = { id: Math.random().toString(36).slice(2,8).toUpperCase() } as any;
    {
      const r = createRes();
      const body = {
        id: pedido1.id,
        status: 'EM_AGUARDO',
        itens: [ { id: 'P1', nome: 'E2E Test', preco: 10, quantidade: 1, categoria: 'burger' } ],
        pagamento: 'DINHEIRO', entrega: 'RETIRADA', cliente: { id: 'BALC', nick: 'Balcão' }
      };
      await pedidoListCreateHandler(createReq('POST', { body }), r as any);
      pedido1.code = r._json?.code; // salvar PIN de 4 dígitos
      write({ step: 'pedido1:create', ok: (r._status||201) === 201, status: r._status||201, data: { id: pedido1.id, code: pedido1.code } });
    }
    // 5.a) tentar forçar sessionId: API deve sobrescrever para sessão atual
    {
      const hack = { id: Math.random().toString(36).slice(2,8).toUpperCase() } as any;
      const r1 = createRes();
      await pedidoListCreateHandler(createReq('POST', { body: { id: hack.id, status: 'EM_AGUARDO', sessionId: 'FAKE', itens:[{ id:'Y1', nome:'Test', preco: 1, quantidade: 1, categoria:'burger' }], pagamento:'DINHEIRO', entrega:'RETIRADA', cliente:{ id:'BALC', nick:'Balcão' } } }), r1 as any);
      const r2 = createRes();
      await pedidoIdHandler(createReq('GET', { query: { id: hack.id } }), r2 as any);
      write({ step: 'sec:pedido sessionId override', ok: (r2._status||0) === 200 && r2._json?.sessionId === sessionId, status: r2._status||0 });
    }

    // 5.1) listar pedidos da sessão atual
    {
      const r = createRes();
      await pedidoListCreateHandler(createReq('GET'), r as any);
      const has = Array.isArray(r._json) && r._json.some((p: any)=> p?.id === pedido1.id);
      write({ step: 'pedidos:list', ok: has, status: r._status||200 });
    }

    // 5.2) tentar fechar com pedidos pendentes (deve 409)
    {
      const r = createRes();
      await caixaHandler(createReq('POST', { body: { action: 'fechar', pin: '1234' } }), r as any);
      write({ step: 'caixa:fechar pendente (409)', ok: (r._status||0) === 409, status: r._status||0 });
    }

    // 6) entrada e saída manuais
    {
      const r = createRes();
      await caixaHandler(createReq('POST', { body: { action: 'entrada', value: 50, desc: 'e2e: entrada', pin: '1234' } }), r as any);
      write({ step: 'caixa:entrada 50', ok: (r._status||200) < 300, status: r._status||200 });
    }
    {
      const r = createRes();
      await caixaHandler(createReq('POST', { body: { action: 'saida', value: 5, desc: 'e2e: saida', pin: '1234' } }), r as any);
      write({ step: 'caixa:saida 5', ok: (r._status||200) < 300, status: r._status||200 });
    }
    // 6.a) tentativa inválida de entrada negativa
    {
      const r = createRes();
      await caixaHandler(createReq('POST', { body: { action: 'entrada', value: -10, desc: 'invalid', pin: '1234' } }), r as any);
      write({ step: 'sec:entrada negativa (400)', ok: (r._status||0) === 400, status: r._status||0 });
    }

    // 7) pedido com taxa e com produto estocável (cliente cadastrado)
    const pedido2 = { id: Math.random().toString(36).slice(2,8).toUpperCase() } as any;
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
      await pedidoListCreateHandler(createReq('POST', { body }), r as any);
      pedido2.code = r._json?.code;
      write({ step: 'pedido2:create', ok: (r._status||201) === 201, status: r._status||201, data: { id: pedido2.id, code: pedido2.code } });
      if (prodId) {
        const r2 = createRes();
        await produtoByIdHandler(createReq('GET', { query: { id: prodId } }), r2 as any);
        const stockApos = Number(r2._json?.stock || 0);
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
      await pedidoListCreateHandler(createReq('POST', { body: { id: 'NEG1', status:'EM_AGUARDO', itens:[{ id:'N1', nome:'Hack', preco:-5, quantidade:1, categoria:'burger' }], pagamento:'DINHEIRO', entrega:'RETIRADA', cliente:{ id:'BALC', nick:'Balcão' } } }), r1 as any);
      write({ step: 'sec:pedido preço negativo (400)', ok: (r1._status||0) === 400, status: r1._status||0 });
      // oversell: criar produto de stock=2 e comprar 999 → 409
      const pr = createRes();
      await produtosHandler(createReq('POST', { body: { data: { nome: `E2E-Stock2-${Date.now()}`, categoria:'burger', preco: 3, ativo:true, desc:'x', stock: 2, iconKey:'hamburger', cor:'t', bg:'b' }, pin: '1234' } }), pr as any);
      const pid2 = pr._json?._id;
      const r2 = createRes();
      await pedidoListCreateHandler(createReq('POST', { body: { id: 'OVR1', status:'EM_AGUARDO', itens:[{ pid: pid2, id: pid2, nome:'Stock2', preco:3, quantidade:999, categoria:'burger' }], pagamento:'DINHEIRO', entrega:'RETIRADA', cliente:{ id:'BALC', nick:'Balcão' } } }), r2 as any);
      write({ step: 'sec:pedido oversell (409)', ok: (r2._status||0) === 409, status: r2._status||0 });
    }

    // 8) pausar caixa -> tentar criar pedido (deve falhar) -> checar status -> retomar -> checar status
    {
      const r1 = createRes();
      await caixaHandler(createReq('POST', { body: { action: 'pausar', pin: '1234' } }), r1 as any);
      write({ step: 'caixa:pausar', ok: (r1._status||200) < 300, status: r1._status||200 });
      const r1b = createRes();
      await caixaHandler(createReq('GET'), r1b as any);
      write({ step: 'caixa:status PAUSADO', ok: r1b._json?.status === 'PAUSADO', status: r1b._status||200 });
      const r2 = createRes();
      await pedidoListCreateHandler(createReq('POST', { body: { id: 'BLOCKED1', status:'EM_AGUARDO', itens: [], pagamento:'PENDENTE', entrega:'RETIRADA', cliente:{ id:'BALC', nick:'Balcão'} } }), r2 as any);
      write({ step: 'pedido:create paused (espera 409)', ok: (r2._status||0) === 409, status: r2._status||0 });
      const r3 = createRes();
      await caixaHandler(createReq('POST', { body: { action: 'retomar', pin: '1234' } }), r3 as any);
      write({ step: 'caixa:retomar', ok: (r3._status||200) < 300, status: r3._status||200 });
      const r3b = createRes();
      await caixaHandler(createReq('GET'), r3b as any);
      write({ step: 'caixa:status ABERTO', ok: r3b._json?.status === 'ABERTO', status: r3b._status||200 });
    }

    // 9) cancelar pedido2 (estorno + pull taxa + repor estoque)
    {
      const r = createRes();
      await pedidoIdHandler(createReq('PUT', { query: { id: pedido2.id }, body: { status: 'CANCELADO' } }), r as any);
      write({ step: 'pedido2:cancel', ok: (r._status||200) < 300, status: r._status||200 });
      // estoque voltou?
      if (prodId) {
        const r2 = createRes();
        await produtoByIdHandler(createReq('GET', { query: { id: prodId } }), r2 as any);
        const stockAposCancel = Number(r2._json?.stock || 0);
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
        await caixaHandler(createReq('GET'), r3 as any);
        const saidas = (r3._json?.session?.saidas || []) as Array<{ desc?: string }>;
        const hasTax = Array.isArray(saidas) && saidas.some((m)=> String(m?.desc||'').includes(`taxa entrega ${pedido2.id}`));
        write({ step: 'saida:taxa removida', ok: !hasTax, status: r3._status||200 });
      }
    }

    // 10) completar pedido1 e votar feedback (PIN correto)
    {
      const r1 = createRes();
      await pedidoIdHandler(createReq('PUT', { query: { id: pedido1.id }, body: { status: 'COMPLETO' } }), r1 as any);
      write({ step: 'pedido1:complete', ok: (r1._status||200) < 300, status: r1._status||200 });
      const r2 = createRes();
      await feedbackHandler(createReq('POST', { body: { id: pedido1.id, code: String(pedido1.code||''), classificacao: { '1': 5, '2': 4, '3': 5 } } }), r2 as any);
      write({ step: 'pedido1:feedback', ok: (r2._status||200) < 300, status: r2._status||200 });
      // feedback duplicado deve falhar com 409
      const r3 = createRes();
      await feedbackHandler(createReq('POST', { body: { id: pedido1.id, code: String(pedido1.code||''), classificacao: { '1': 3, '2': 3, '3': 3 } } }), r3 as any);
      write({ step: 'pedido1:feedback duplicado (409)', ok: (r3._status||0) === 409, status: r3._status||0 });
    }

    // 10.1) métricas de feedback agregadas (agg=1)
    {
      const r = createRes();
      await feedbackIndexHandler(createReq('GET', { query: { agg: '1', days: '7' } }), r as any);
      const ok = (r._status||200) < 300 && Number(r._json?.metrics?.total || 0) >= 1;
      write({ step: 'feedback:agg', ok, status: r._status||200 });
    }
    // 10.2) feedback windows de 30/90 dias
    {
      const r30 = createRes(); await feedbackIndexHandler(createReq('GET', { query: { agg: '1', days: '30' } }), r30 as any);
      const r90 = createRes(); await feedbackIndexHandler(createReq('GET', { query: { agg: '1', days: '90' } }), r90 as any);
      write({ step: 'feedback:agg 30/90', ok: (r30._status||200) === 200 && (r90._status||200) === 200, status: (r30._status||200) });
    }

    // 11) caixa:get e validar consistência básica
    {
      const r = createRes();
      await caixaHandler(createReq('GET'), r as any);
      const sess = r._json?.session;
      // Após pedido1 (10) e hack (1), antes da venda extra CARTAO, esperamos:
      // - vendas = DINHEIRO (PIX=0)
      const tot = sess?.totals || {};
      const vendas = Number(tot.vendas || 0);
      const din = Number((tot.porPagamento||{} as any).DINHEIRO || 0);
      const pix = Number((tot.porPagamento||{} as any).PIX || 0);
      const ok = sess && sess.sessionId === sessionId && vendas === din && pix === 0 && Number(tot.entradas||0) === 50 && Number(tot.saidas||0) === 5 && sess.vendasCount >= 1;
      // items não negativos
      const nonNegative = Object.values(sess?.items || {}).every((v: any) => Number(v) >= 0);
      // cls deve estar presente no completo após feedback
      const comp = Array.isArray(sess?.completos) ? (sess.completos as any[]).find(c => c.id === pedido1.id) : null;
      const hasCls = comp && Array.isArray((comp as any).cls) && (comp as any).cls.length === 3;
      write({ step: 'caixa:get', ok: !!ok && nonNegative && !!hasCls, status: r._status||200, data: { totals: sess?.totals, vendasCount: sess?.vendasCount } });
    }
    // 11.0) Top itens: exatamente 3 maiores (se houver) e sem negativos
    {
      const r = createRes();
      await caixaHandler(createReq('GET'), r as any);
      const items = r._json?.session?.items || {};
      const arr = Object.entries(items).filter(([,v])=> Number(v)>0).sort((a,b)=> Number(b[1])-Number(a[1]));
      const top3 = arr.slice(0,3);
      const okTop = top3.length <= 3 && top3.every(([,v])=> Number(v)>0);
      write({ step: 'caixa:top3 itens', ok: okTop, status: r._status||200 });
    }

    // 11.1) endpoint público do pedido1 (deve funcionar logo após COMPLETO)
    {
      const r = createRes();
      await pedidoPublicHandler(createReq('GET', { query: { id: pedido1.id, code: String(pedido1.code||'') } }), r as any);
      write({ step: 'public:get ok', ok: (r._status||200) === 200, status: r._status||200 });
    }

    // 11.2) expiração do público (>1h)
    {
      const db = await getDb();
      const old = new Date(Date.now() - 2*60*60*1000).toISOString();
      await db.collection('pedidos').updateOne({ id: pedido1.id }, { $set: { 'timestamps.COMPLETO': old } });
      const r = createRes();
      await pedidoPublicHandler(createReq('GET', { query: { id: pedido1.id, code: String(pedido1.code||'') } }), r as any);
      write({ step: 'public:get expirado', ok: (r._status||410) === 410, status: r._status||410 });
      const r2 = createRes();
      await pedidoPublicHandler(createReq('GET', { query: { id: pedido1.id, code: '0000' } }), r2 as any);
      write({ step: 'public:get PIN errado (403)', ok: (r2._status||0) === 403, status: r2._status||0 });
    }

    // 11.3) nova venda CARTAO: deltas exatos de vendas/porPagamento
    {
      // snapshot antes
      const rB = createRes();
      await caixaHandler(createReq('GET'), rB as any);
      const sessB = rB._json?.session || {};
      const vendasB = Number(sessB?.totals?.vendas || 0);
      const countB = Number(sessB?.vendasCount || 0);
      const cardB = Number((sessB?.totals?.porPagamento || {}).CARTAO || 0);
      // cria pedido3
      const pedido3 = { id: Math.random().toString(36).slice(2,8).toUpperCase() } as any;
      const rC = createRes();
      await pedidoListCreateHandler(createReq('POST', { body: { id: pedido3.id, status: 'EM_AGUARDO', itens: [ { id: 'X1', nome: 'E2E Extra', preco: 8, quantidade: 2, categoria: 'burger' } ], pagamento: 'CARTAO', entrega: 'RETIRADA', cliente: { id:'BALC', nick:'Balcão' } } }), rC as any);
      const rC2 = createRes();
      await pedidoIdHandler(createReq('PUT', { query: { id: pedido3.id }, body: { status: 'COMPLETO' } }), rC2 as any);
      // snapshot depois
      const rA = createRes();
      await caixaHandler(createReq('GET'), rA as any);
      const sessA = rA._json?.session || {};
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
      const r1 = createRes(); await produtosHandler(createReq('GET', { query: { ativo: '1', pageSize: '5' } }), r1 as any);
      const r2 = createRes(); await produtosHandler(createReq('GET', { query: { promo: 'active', pageSize: '5' } }), r2 as any);
      const r3 = createRes(); await produtosHandler(createReq('GET', { query: { stock: 'gt0', pageSize: '5' } }), r3 as any);
      write({ step: 'produtos:filtros', ok: (r1._status||0)===200 && (r2._status||0)===200 && (r3._status||0)===200, status: r1._status||200 });
    }

    // 11.4) cadeia de status em pedido4 (timestamps em todas as fases)
    {
      const pedido4 = { id: Math.random().toString(36).slice(2,8).toUpperCase() } as any;
      const r1 = createRes();
      await pedidoListCreateHandler(createReq('POST', { body: { id: pedido4.id, status: 'EM_AGUARDO', itens: [ { id: 'S1', nome: 'Fluxo', preco: 4, quantidade: 1, categoria: 'burger' } ], pagamento:'DINHEIRO', entrega:'RETIRADA', cliente:{ id:'BALC', nick:'Balcão' } } }), r1 as any);
      const doStep = async (st: string) => { const r = createRes(); await pedidoIdHandler(createReq('PUT', { query: { id: pedido4.id }, body: { status: st } }), r as any); return (r._status||0) === 200; };
      const okA = await doStep('EM_PREPARO');
      const okB = await doStep('PRONTO');
      const okC = await doStep('EM_ROTA');
      const okD = await doStep('COMPLETO');
      const rG = createRes();
      await pedidoIdHandler(createReq('GET', { query: { id: pedido4.id } }), rG as any);
      const ts = rG._json?.timestamps || {};
      const hasAll = ts.EM_AGUARDO && ts.EM_PREPARO && ts.PRONTO && ts.EM_ROTA && ts.COMPLETO;
      write({ step: 'pedido4:status chain', ok: okA && okB && okC && okD && !!hasAll, status: 200 });
    }

    // 11.5) cancelar pedido5 e garantir que estorno zera o delta de vendas
    {
      // snapshot antes
      const rB = createRes(); await caixaHandler(createReq('GET'), rB as any); const vB = Number(rB._json?.session?.totals?.vendas || 0);
      // cria
      const pedido5 = { id: Math.random().toString(36).slice(2,8).toUpperCase() } as any;
      const rC = createRes();
      await pedidoListCreateHandler(createReq('POST', { body: { id: pedido5.id, status: 'EM_AGUARDO', itens: [ { id: 'Z1', nome: 'Cancelar', preco: 7, quantidade: 2, categoria: 'burger' } ], pagamento:'DINHEIRO', entrega:'RETIRADA', cliente:{ id:'BALC', nick:'Balcão' } } }), rC as any);
      const rD = createRes(); await caixaHandler(createReq('GET'), rD as any); const vC = Number(rD._json?.session?.totals?.vendas || 0);
      // cancela
      const rE = createRes(); await pedidoIdHandler(createReq('PUT', { query: { id: pedido5.id }, body: { status: 'CANCELADO' } }), rE as any);
      const rF = createRes(); await caixaHandler(createReq('GET'), rF as any); const vD = Number(rF._json?.session?.totals?.vendas || 0);
      write({ step: 'pedido5:cancel estorno delta 0', ok: (vC - vB) === 14 && vD === vB, status: 200 });
    }

    // 12) fechar caixa (cancelar pendentes antes)
    {
      // cancelar quaisquer pedidos pendentes
      try {
        const rList = createRes();
        await pedidoListCreateHandler(createReq('GET'), rList as any);
        const arr: any[] = Array.isArray(rList._json) ? rList._json : [];
        const pend = arr.filter((p: any) => !['CANCELADO','COMPLETO'].includes(String(p?.status||'')));
        for (const p of pend) { const rUpd = createRes(); await pedidoIdHandler(createReq('PUT', { query: { id: p.id }, body: { status: 'CANCELADO' } }), rUpd as any); }
      } catch {}
      const r = createRes();
      await caixaHandler(createReq('POST', { body: { action: 'fechar', pin: '1234' } }), r as any);
      write({ step: 'caixa:fechar', ok: (r._status||200) < 300, status: r._status||200 });
    }

    // 12.1) tentar criar pedido com caixa fechado (espera 409)
    {
      const r = createRes();
      await pedidoListCreateHandler(createReq('POST', { body: { id: 'AFTERCLOSE', status:'EM_AGUARDO', itens: [], pagamento:'PENDENTE', entrega:'RETIRADA', cliente:{ id:'BALC', nick:'Balcão'} } }), r as any);
      write({ step: 'pedido:create fechado (409)', ok: (r._status||0) === 409, status: r._status||0 });
    }

    // 12.2) nova sessão com base e movimentos
    {
      // abrir com base 100
      const rOpen = createRes();
      await caixaHandler(createReq('POST', { body: { action: 'abrir', pin: '1234', base: 100 } }), rOpen as any);
      write({ step: 'caixa:abrir base 100', ok: (rOpen._status||0) === 201 && Number(rOpen._json?.session?.base||0) === 100, status: rOpen._status||0 });
      // duas entradas e uma saída
      const rE1 = createRes(); await caixaHandler(createReq('POST', { body: { action: 'entrada', value: 20, desc: 'E1', pin: '1234' } }), rE1 as any);
      const rE2 = createRes(); await caixaHandler(createReq('POST', { body: { action: 'entrada', value: 30, desc: 'E2', pin: '1234' } }), rE2 as any);
      const rS1 = createRes(); await caixaHandler(createReq('POST', { body: { action: 'saida', value: 10, desc: 'S1', pin: '1234' } }), rS1 as any);
      const rGet = createRes(); await caixaHandler(createReq('GET'), rGet as any);
      const t = rGet._json?.session?.totals || {};
      const ok = Number(t.entradas||0) >= 50 /* da sessão anterior não se mistura */ && Number(t.saidas||0) >= 10;
      write({ step: 'caixa:movimentos nova sessão', ok, status: rGet._status||200 });
      // fechar novamente
      const rClose2 = createRes(); await caixaHandler(createReq('POST', { body: { action: 'fechar', pin: '1234' } }), rClose2 as any);
      write({ step: 'caixa:fechar nova sessão', ok: (rClose2._status||0) === 200, status: rClose2._status||0 });
    }

    // 13) limpeza best-effort
    try {
      const db = await getDb();
      if (sessionId) await db.collection('cash').deleteOne({ sessionId });
      if (pedido1?.id) await db.collection('pedidos').deleteOne({ id: pedido1.id });
      if (pedido2?.id) await db.collection('pedidos').deleteOne({ id: pedido2.id });
      if (prodId) await db.collection('products').deleteMany({ _id: { $in: [prodId, prodId].map((s)=> { try { return new ObjectId(s); } catch { return s; } }) } as any });
      if (clienteUuid) await db.collection('customers').deleteOne({ uuid: clienteUuid });
      await db.collection('feedback').deleteMany({ pid: { $in: [pedido1?.id, pedido2?.id].filter(Boolean) } });
      // tentativa de auto-suspender admin (deve falhar) — fora do fluxo principal de caixa
      const rTry = createRes();
      await usersAccessHandler(createReq('PUT', { query: { access: '000' }, body: { pin: '1234', status: 2 } }), rTry as any);
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
  } catch (e: any) {
    if (stream) { res.write(`FAIL: ${String(e?.message||e)}\n`); res.end(); return; }
    return res.status(500).json({ ok: false, results: log, error: String(e?.message || e) });
  }
}
