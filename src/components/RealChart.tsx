import React from 'react';

export default function RealChart({ type }: { type: 'line'|'bars'|'pie'|'barsH'|'line2'|'stacked' }) {
  // Placeholder “real” chart (simulado) via canvas. Quando integrar lib, substituir aqui (Chart.js/Recharts/etc.)
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const dpr = typeof window !== 'undefined' ? Math.max(1, window.devicePixelRatio || 1) : 1;
    const rect = el.getBoundingClientRect();
    el.width = Math.floor(rect.width * dpr);
    el.height = Math.floor(rect.height * dpr);
    const ctx = el.getContext('2d'); if (!ctx) return;
    ctx.scale(dpr, dpr);
    const color = 'rgba(180,180,220,0.9)';
    const color2 = 'rgba(120,180,240,0.85)';
    ctx.clearRect(0,0,rect.width,rect.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let y=rect.height-10; y>0; y-=12) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(rect.width,y); ctx.stroke(); }
    const seed = 77 + type.length;
    const rand = (i:number) => Math.abs(Math.sin(seed * (i+1))) % 1;
    if (type === 'bars' || type === 'barsH' || type === 'stacked') {
      if (type === 'bars') {
        const n = 12; const bw = Math.max(6, Math.floor(rect.width/(n*1.6)));
        ctx.fillStyle = color;
        for (let i=0;i<n;i++) { const v = 10 + rand(i)* (rect.height-24); const x = 10 + i*(bw+6); const y = rect.height - v; ctx.globalAlpha = 0.4 + (i/n)*0.5; ctx.fillRect(x, y, bw, v); }
      } else if (type === 'barsH') {
        const n = 6; const bh = Math.max(8, Math.floor((rect.height-20)/n)-4);
        ctx.fillStyle = color;
        for (let i=0;i<n;i++) { const w = 20 + rand(i)* (rect.width-40); const y = 10 + i*(bh+6); ctx.globalAlpha = 0.6 - i*0.05; ctx.fillRect(12, y, w, bh); }
      } else {
        const groups = 6; const bw = Math.max(10, Math.floor(rect.width/(groups*2)));
        for (let i=0;i<groups;i++) {
          const x = 12 + i*(bw+16);
          const a = 10 + rand(i)* (rect.height*0.3);
          const b = 10 + rand(i+1)* (rect.height*0.25);
          const c = 10 + rand(i+2)* (rect.height*0.2);
          let y = rect.height - a; ctx.globalAlpha = 0.35; ctx.fillStyle = 'rgba(168,85,247,0.9)'; ctx.fillRect(x, y, bw, a);
          y -= b; ctx.globalAlpha = 0.5; ctx.fillStyle = 'rgba(245,158,11,0.9)'; ctx.fillRect(x, y, bw, b);
          y -= c; ctx.globalAlpha = 0.8; ctx.fillStyle = 'rgba(16,185,129,0.9)'; ctx.fillRect(x, y, bw, c);
        }
      }
    } else if (type === 'pie') {
      const cx = rect.width/2, cy = rect.height/2, r = Math.min(cx, cy)-8;
      const parts = [0.52, 0.28, 0.20];
      const cols = ['rgba(16,185,129,0.9)','rgba(56,189,248,0.9)','rgba(244,63,94,0.9)'];
      let ang = -Math.PI/2;
      for (let i=0;i<parts.length;i++) {
        const a2 = ang + parts[i]*Math.PI*2;
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.fillStyle = cols[i]; ctx.globalAlpha = 0.7; ctx.arc(cx,cy,r,ang,a2); ctx.closePath(); ctx.fill(); ang = a2;
      }
      ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(cx,cy,r*0.55,0,Math.PI*2); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    } else {
      const n = 14; const pts: Array<[number,number]> = [];
      for (let i=0;i<n;i++) { const x = (rect.width/(n-1))*i; const y = rect.height - (10 + rand(i)* (rect.height-20)); pts.push([x,y]); }
      ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.globalAlpha = 0.9; ctx.beginPath(); pts.forEach(([x,y],i)=> { if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke();
      ctx.globalAlpha = 0.18; ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(pts[0][0], rect.height); pts.forEach(([x,y])=> ctx.lineTo(x,y)); ctx.lineTo(pts[pts.length-1][0], rect.height); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.5; ctx.strokeStyle = color2; ctx.setLineDash([4,4]); const y = rect.height*0.4; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(rect.width,y); ctx.stroke(); ctx.setLineDash([]);
    }
  }, [type]);
  return <canvas ref={ref} className="w-full h-full" />;
}

