import React from 'react';
import { FaEyeSlash } from 'react-icons/fa';
import { playUiSound } from '@/utils/sound';

type StatusMeta = { key: string; label: string };

export default function HiddenColumnsPanel({ hiddenCols, statusList, onUnhide }: {
  hiddenCols: string[];
  statusList: StatusMeta[];
  onUnhide: (key: string) => void;
}) {
  const [showMobileCols, setShowMobileCols] = React.useState(false);
  if (hiddenCols.length === 0) return null;
  return (
    <>
      <div className="fixed left-2 top-1/2 -translate-y-1/2 z-40 hidden sm:flex flex-col gap-2">
        {hiddenCols.map((key) => {
          const meta = statusList.find(s => s.key === key);
          if (!meta) return null;
          const mapBg: Record<string, string> = {
            EM_AGUARDO: 'bg-gray-500/20 text-gray-300 border-gray-500',
            EM_PREPARO: 'bg-orange-500/20 text-orange-300 border-orange-500',
            PRONTO: 'bg-yellow-500/20 text-yellow-300 border-yellow-500',
            EM_ROTA: 'bg-blue-500/20 text-blue-300 border-blue-500',
            COMPLETO: 'bg-green-500/20 text-green-300 border-green-500',
          };
          const colorCls = mapBg[key] ?? 'bg-zinc-700/20 text-zinc-300 border-zinc-600';
          return (
            <button
              key={key}
              className={`px-3 py-2 rounded-lg border ${colorCls} shadow hover:opacity-90 transition text-xs font-semibold`}
              onMouseEnter={() => playUiSound('hover')}
              onClick={() => { playUiSound('click'); onUnhide(key); }}
              title={`Mostrar ${meta.label}`}
            >
              Mostrar {meta.label}
            </button>
          );
        })}
      </div>
      <div className="sm:hidden fixed bottom-4 right-4 z-40">
        <button
          className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-100 shadow-lg flex items-center justify-center"
          onMouseEnter={() => playUiSound('hover')}
          onClick={() => { playUiSound('click'); setShowMobileCols(v=>!v); }}
          title="Colunas ocultas"
        >
          <FaEyeSlash />
        </button>
        {showMobileCols && (
          <div className="absolute right-0 bottom-14 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-2 min-w-[220px]">
            <div className="text-xs text-zinc-500 px-2 pb-1">Reexibir colunas</div>
            {hiddenCols.map(key => (
              <button
                key={key}
                className="w-full text-left text-sm text-zinc-200 hover:bg-zinc-800 rounded-lg px-2 py-1.5"
                onMouseEnter={() => playUiSound('hover')}
                onClick={() => { playUiSound('click'); onUnhide(key); setShowMobileCols(false); }}
              >
                Mostrar {statusList.find(s=>s.key===key)?.label || key}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

