import { ctx } from '@/main';

export function fillBg(color = '#1a1a2e'): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

export function drawTitle(text: string, y: number, color = '#ffffff', size = 36): void {
  ctx.save();
  ctx.font = `bold ${size}px monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, ctx.canvas.width / 2, y);
  ctx.restore();
}

export function drawText(text: string, x: number, y: number, opts?: { color?: string; size?: number; align?: CanvasTextAlign }): void {
  ctx.save();
  ctx.font = `bold ${opts?.size ?? 20}px monospace`;
  ctx.fillStyle = opts?.color ?? '#ffffff';
  ctx.textAlign = opts?.align ?? 'left';
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function drawMenuItem(text: string, y: number, selected: boolean): void {
  const x = ctx.canvas.width / 2;
  ctx.save();
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = selected ? '#ffcc00' : '#888888';
  ctx.fillText((selected ? '> ' : '  ') + text, x, y);
  ctx.restore();
}

export function drawStatBar(label: string, value: number, max: number, x: number, y: number, barW = 200): void {
  const barH = 14;
  const filled = Math.min(1, value / max);

  ctx.save();
  ctx.font = '16px monospace';
  ctx.fillStyle = '#aaaaaa';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y);

  const bx = x + 120;
  ctx.fillStyle = '#333333';
  ctx.fillRect(bx, y - barH + 2, barW, barH);
  ctx.fillStyle = filled > 0.7 ? '#44ff44' : filled > 0.4 ? '#ffaa00' : '#ff4444';
  ctx.fillRect(bx, y - barH + 2, barW * filled, barH);
  ctx.restore();
}

export function drawMoney(amount: number): void {
  ctx.save();
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = '#44ff44';
  ctx.textAlign = 'right';
  ctx.fillText(`$${Math.floor(amount)}`, ctx.canvas.width - 20, 30);
  ctx.restore();
}

export function centerX(): number {
  return ctx.canvas.width / 2;
}

export function getOrdinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return n + 'th';
  const last = n % 10;
  if (last === 1) return n + 'st';
  if (last === 2) return n + 'nd';
  if (last === 3) return n + 'rd';
  return n + 'th';
}

export function drawHUDBar(
  c: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  ratio: number,
): void {
  ratio = Math.max(0, Math.min(1, ratio));
  const color = ratio > 0.7 ? '#44ff44' : ratio > 0.4 ? '#ffaa00' : '#ff4444';

  c.fillStyle = '#333333';
  c.fillRect(x, y, w, h);
  c.fillStyle = color;
  c.fillRect(x, y, w * ratio, h);
  c.strokeStyle = '#666666';
  c.lineWidth = 1;
  c.strokeRect(x, y, w, h);
}
