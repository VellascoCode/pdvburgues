// src/utils/indexedDB.ts
// Utilitário para persistência local usando IndexedDB

export type PedidoItem = string | {
  nome: string;
  quantidade?: number;
  preco?: number | string;
  icon?: string;
};

export type Pedido = {
  id: string;
  status: string;
  itens: PedidoItem[];
  tempo?: string;
  criadoEm?: string;
  pagamento?: string;
  entrega?: string;
  observacoes?: string;
};

const DB_NAME = 'pdvburgues';
const DB_VERSION = 1;
const STORE_PEDIDOS = 'pedidos';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PEDIDOS)) {
        db.createObjectStore(STORE_PEDIDOS, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function salvarPedido(pedido: Pedido): Promise<void> {
  if (!pedido.criadoEm) {
    pedido.criadoEm = new Date().toISOString();
  }
  const db = await openDB();
  const tx = db.transaction(STORE_PEDIDOS, 'readwrite');
  tx.objectStore(STORE_PEDIDOS).put(pedido);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listarPedidos(): Promise<Pedido[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_PEDIDOS, 'readonly');
  const store = tx.objectStore(STORE_PEDIDOS);
  return new Promise((resolve, reject) => {
    const pedidos: Pedido[] = [];
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        pedidos.push(cursor.value);
        cursor.continue();
      } else {
        resolve(pedidos);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function removerPedido(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_PEDIDOS, 'readwrite');
  tx.objectStore(STORE_PEDIDOS).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function limparPedidos(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_PEDIDOS, 'readwrite');
  tx.objectStore(STORE_PEDIDOS).clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function atualizarStatusPedido(id: string, status: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_PEDIDOS, 'readwrite');
  const store = tx.objectStore(STORE_PEDIDOS);
  const req = store.get(id);
  req.onsuccess = () => {
    const pedido = req.result;
    if (pedido) {
      pedido.status = status;
      store.put(pedido);
    }
  };
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
