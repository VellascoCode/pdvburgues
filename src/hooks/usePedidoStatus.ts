import { useCallback } from 'react';
import { updatePedidoStatus } from '@/lib/pedidosClient';
import { emit } from '@/utils/eventBus';

type Options = {
  onAfterChange?: () => Promise<void> | void;
};

export function usePedidoStatusUpdater(options: Options = {}) {
  const { onAfterChange } = options;
  return useCallback(async (id: string, status: string) => {
    await updatePedidoStatus(id, status);
    emit('cash:refresh');
    if (onAfterChange) {
      await onAfterChange();
    }
  }, [onAfterChange]);
}
