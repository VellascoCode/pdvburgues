import { Pedido } from "./indexedDB";

const MILLISECONDS_IN_SECOND = 1000;
const MILLISECONDS_IN_MINUTE = 60 * MILLISECONDS_IN_SECOND;

function parseTempoString(tempo?: string): number | null {
  if (!tempo) return null;
  const partes = tempo.split(":").map((parte) => Number(parte));
  if (partes.some((parte) => Number.isNaN(parte))) return null;
  if (partes.length === 2) {
    const [minutos, segundos] = partes;
    return (minutos * 60 + segundos) * MILLISECONDS_IN_SECOND;
  }
  if (partes.length === 3) {
    const [horas, minutos, segundos] = partes;
    return (horas * 3600 + minutos * 60 + segundos) * MILLISECONDS_IN_SECOND;
  }
  return null;
}

export function calcularTempoDoPedido(pedido: Pedido, agora = Date.now()): number | null {
  if (pedido.criadoEm) {
    const criadoEm = Date.parse(pedido.criadoEm);
    if (!Number.isNaN(criadoEm)) {
      return Math.max(0, agora - criadoEm);
    }
  }
  return parseTempoString(pedido.tempo);
}

export function formatarDuracao(ms: number): string {
  const minutos = Math.floor(ms / MILLISECONDS_IN_MINUTE);
  const segundos = Math.floor((ms % MILLISECONDS_IN_MINUTE) / MILLISECONDS_IN_SECOND);
  return `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
}

export function pedidoEstaAtrasado(pedido: Pedido, agora = Date.now()): boolean {
  const tempo = calcularTempoDoPedido(pedido, agora);
  if (tempo === null) return false;
  return tempo >= 15 * MILLISECONDS_IN_MINUTE;
}
