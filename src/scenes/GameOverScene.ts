import Phaser from 'phaser';
import { ctx } from '@/main';
import { fillBg, drawTitle, drawMenuItem, drawText, centerX } from './CanvasUI';

export class GameOverScene extends Phaser.Scene {
  private sel = 0;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() {
    super('GameOverScene');
  }

  create(): void {
    this.sel = 0;
    const kb = this.input.keyboard!;
    this.enterKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.cursorKeys = kb.createCursorKeys();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const h = this.scale.height;
      if (p.y < h * 0.4) {
        this.sel = Math.max(0, this.sel - 1);
      } else if (p.y > h * 0.6) {
        this.sel = Math.min(1, this.sel + 1);
      } else {
        if (this.sel === 0) {
          this.scene.start('MainMenuScene');
        } else {
          this.scene.start('GarageScene');
        }
      }
    });
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.cursorKeys.up)) {
      this.sel = Math.max(0, this.sel - 1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursorKeys.down)) {
      this.sel = Math.min(1, this.sel + 1);
    }

    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      if (this.sel === 0) {
        this.scene.start('MainMenuScene');
      } else {
        this.scene.start('GarageScene');
      }
    }

    this.render();
  }

  private render(): void {
    fillBg('#0a0a1e');

    const cx = centerX();
    const cy = ctx.canvas.height / 2;

    drawTitle('CONGRATULATIONS', cy - 120, '#ffcc00', 42);
    drawText('You conquered all tracks!', cx, cy - 60, { color: '#ffffff', size: 22, align: 'center' });
    drawText('Road Rash Master', cx, cy - 20, { color: '#ff4444', size: 28, align: 'center' });

    drawMenuItem('RETURN TO MENU', cy + 60, this.sel === 0);
    drawMenuItem('GO TO GARAGE', cy + 100, this.sel === 1);

    drawText('ENTER: Select  |  UP/DOWN: Choose', cx, ctx.canvas.height - 20, { color: '#555555', size: 13, align: 'center' });
  }
}
