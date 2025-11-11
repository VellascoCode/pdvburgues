import React from 'react';

export default function Toggle({ checked, onChange, label, className = '' }: { checked: boolean; onChange: (v: boolean) => void; label?: string; className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 select-none ${label ? 'py-1' : ''} ` + className}
    >
      <span className={`w-11 h-6 rounded-full border transition-all relative ${checked ? 'bg-emerald-600 border-emerald-500' : 'bg-zinc-700 border-zinc-600'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      {label && <span className="text-sm theme-text">{label}</span>}
    </button>
  );
}

