import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;
  const uri = process.env.MONGODB_URI as string;
  if (!uri) throw new Error('MONGODB_URI não configurada');
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(uri.split('/').pop() || 'pdv1');
  return db;
}

