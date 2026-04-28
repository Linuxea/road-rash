import Phaser from 'phaser';

interface TouchButton {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  active: boolean;
  color: string;
  arrestOnly: boolean;
}

export class TouchControls {
  private buttons: TouchButton[] = [];
  private justPressed = new Set<string>();
  readonly enabled: boolean;
  private scene: Phaser.Scene;
  private pointerButtons = new Map<number, string>();
  private showArrestBtns = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.enabled = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    if (!this.enabled) return;

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handleDown(pointer);
    });
    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.handleUp(pointer);
    });
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.handleMove(pointer);
    });
    this.scene.input.on('pointercancel', (pointer: Phaser.Input.Pointer) => {
      this.handleUp(pointer);
    });
  }

  setArrestMode(show: boolean): void {
    this.showArrestBtns = show;
  }

  layout(w: number, h: number): void {
    if (!this.enabled) return;

    const btnH = 56;
    const gap = 8;
    const margin = 12;
    const bottomPad = 8;

    // Left side: d-pad — positioned below HUD zone (h-130 gives room for health/weapon)
    const dpadY = h - bottomPad - btnH;

    // Right side: action buttons — positioned below speed HUD (h-150)
    const actW = 68;
    const actH = 56;
    const actGap = 6;
    const actY1 = h - bottomPad - actH * 2 - actGap - btnH;
    const actY2 = h - bottomPad - actH - btnH;

    this.buttons = [
      // D-pad
      { id: 'left',  x: margin, y: dpadY, w: 68, h: btnH, label: '◄', active: false, color: '#4488ff', arrestOnly: false },
      { id: 'right', x: margin + 68 + gap, y: dpadY, w: 68, h: btnH, label: '►', active: false, color: '#4488ff', arrestOnly: false },
      // Action buttons
      { id: 'punchLeft',  x: w - margin - actW * 2 - actGap, y: actY1, w: actW, h: actH, label: 'Punch', active: false, color: '#ff8844', arrestOnly: false },
      { id: 'punchRight', x: w - margin - actW, y: actY1, w: actW, h: actH, label: 'Punch', active: false, color: '#ff8844', arrestOnly: false },
      { id: 'kick',       x: w - margin - actW * 1.5 - actGap / 2, y: actY2, w: actW * 1.5, h: actH, label: 'KICK', active: false, color: '#ff4444', arrestOnly: false },
      // Arrest-only buttons
      { id: 'restart', x: w * 0.25 - 60, y: h * 0.55, w: 120, h: 50, label: 'RETRY', active: false, color: '#44cc44', arrestOnly: true },
      { id: 'esc',     x: w * 0.75 - 60, y: h * 0.55, w: 120, h: 50, label: 'QUIT', active: false, color: '#cc4444', arrestOnly: true },
    ];
  }

  isDown(id: string): boolean {
    return this.buttons.some(b => b.id === id && b.active);
  }

  justDown(id: string): boolean {
    return this.justPressed.has(id);
  }

  clearFrameState(): void {
    this.justPressed.clear();
  }

  render(c: CanvasRenderingContext2D): void {
    if (!this.enabled) return;
    for (const btn of this.buttons) {
      if (btn.arrestOnly && !this.showArrestBtns) continue;
      if (!btn.arrestOnly && this.showArrestBtns) continue;

      c.save();
      c.globalAlpha = btn.active ? 0.6 : 0.25;
      c.fillStyle = btn.active ? btn.color : '#666666';
      c.strokeStyle = btn.active ? '#ffffff' : '#999999';
      c.lineWidth = 2;
      c.beginPath();
      c.roundRect(btn.x, btn.y, btn.w, btn.h, 8);
      c.fill();
      c.stroke();

      c.globalAlpha = 1;
      c.font = 'bold 14px monospace';
      c.fillStyle = '#ffffff';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
      c.restore();
    }
  }

  private hitTest(px: number, py: number): TouchButton | undefined {
    for (const btn of this.buttons) {
      if (btn.arrestOnly !== this.showArrestBtns) continue;
      if (px >= btn.x && px <= btn.x + btn.w && py >= btn.y && py <= btn.y + btn.h) {
        return btn;
      }
    }
    return undefined;
  }

  private handleDown(pointer: Phaser.Input.Pointer): void {
    const btn = this.hitTest(pointer.x, pointer.y);
    if (btn) {
      btn.active = true;
      this.justPressed.add(btn.id);
      this.pointerButtons.set(pointer.id, btn.id);
    }
  }

  private handleUp(pointer: Phaser.Input.Pointer): void {
    const btnId = this.pointerButtons.get(pointer.id);
    if (btnId) {
      const btn = this.buttons.find(b => b.id === btnId);
      if (btn) btn.active = false;
      this.pointerButtons.delete(pointer.id);
    }
  }

  private handleMove(pointer: Phaser.Input.Pointer): void {
    const btnId = this.pointerButtons.get(pointer.id);
    if (!btnId) return;
    const btn = this.hitTest(pointer.x, pointer.y);
    if (!btn || btn.id !== btnId) {
      const prev = this.buttons.find(b => b.id === btnId);
      if (prev) prev.active = false;
      this.pointerButtons.delete(pointer.id);
    }
  }
}
