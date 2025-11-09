import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/lib/mongodb';
import mockData from '@/mock-pedidos.json';

type Pedido = {
  id: string;
  status: string;
  itens: Array<{ nome?: string; quantidade?: number; preco?: number|string } | string>;
  criadoEm?: string;
};
type MockData = { pedidos: Pedido[] };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }
  const db = await getDb();
  const col = db.collection('pedidos');
  await col.deleteMany({});

  const animals = ['Lobo','Raposa','Tigre','Leão','Falcão','Pantera','Urso','Águia','Touro','Lince','Coiote','Cobra','Tubarão','Onça'];
  const rand = (min:number,max:number)=> Math.floor(Math.random()*(max-min+1))+min;
  const now = Date.now();
  const docs = (mockData as unknown as MockData).pedidos.map((p) => {
    const offsetMin = rand(0, 120);
    const criadoEm = new Date(now - offsetMin*60*1000).toISOString();
    const id4 = Math.random().toString(36).slice(2,6).toUpperCase();
    const genero = ['M','F','O'][rand(0,2)];
    const code = String(Math.floor(1000 + Math.random()*9000));
    const cliente = {
      id: id4,
      nick: animals[rand(0, animals.length-1)],
      genero,
      estrelas: rand(2,5), gasto: rand(2,5), simpatia: rand(2,5)
    };
    const status = p.status || 'EM_AGUARDO';
    return {
      ...p,
      criadoEm,
      code,
      cliente,
      timestamps: { [status]: criadoEm },
      pagamentoStatus: 'PENDENTE'
    };
  });
  await col.insertMany(docs);
  return res.status(201).json({ inserted: docs.length });
}
