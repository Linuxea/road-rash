import Phaser from 'phaser';
import { ctx } from '@/main';
import { SaveManager } from '@/save';
import type { SaveData } from '@/save';
import { LEVELS } from '@/levels';
import { fillBg, drawTitle, drawMenuItem, drawText, drawMoney, centerX } from './CanvasUI';

export class LevelSelectScene extends Phaser.Scene {
  private saveData!: SaveData;
  private sel = 0;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('LevelSelectScene');
  }

  create(): void {
    this.saveData = SaveManager.load();
    this.sel = 0;
    const kb = this.input.keyboard!;
    this.cursorKeys = kb.createCursorKeys();
    this.enterKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.escKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const h = this.scale.height;
      if (p.y < h * 0.4) {
        this.sel = Math.max(0, this.sel - 1);
      } else if (p.y > h * 0.6) {
        this.sel = Math.min(this.saveData.unlockedLevels.length - 1, this.sel + 1);
      } else {
        const unlocked = this.saveData.unlockedLevels;
        if (this.sel < unlocked.length) {
          this.scene.start('RaceScene', { levelId: unlocked[this.sel] });
        }
      }
    });
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.scene.start('GarageScene');
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursorKeys.up)) {
      this.sel = Math.max(0, this.sel - 1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursorKeys.down)) {
      this.sel = Math.min(this.saveData.unlockedLevels.length - 1, this.sel + 1);
    }

    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      const unlocked = this.saveData.unlockedLevels;
      if (this.sel < unlocked.length) {
        const levelId = unlocked[this.sel];
        this.scene.start('RaceScene', { levelId });
      }
    }

    this.render();
  }

  private render(): void {
    fillBg('#0a0a1e');
    drawTitle('SELECT LEVEL', 40);
    drawMoney(this.saveData.money);

    const cx = centerX();
    const unlocked = this.saveData.unlockedLevels;

    for (let i = 0; i < unlocked.length; i++) {
      const lvl = LEVELS[unlocked[i] - 1];
      if (!lvl) continue;
      const best = this.saveData.bestTimes[unlocked[i]];
      const bestStr = best !== undefined ? `Best: ${Math.floor(best)}s` : '';
      const label = `${lvl.name}  ${bestStr}`;
      const selected = this.sel === i;
      drawMenuItem(label, 100 + i * 40, selected);

      if (selected) {
        drawText(`Time: ${lvl.timeLimit}s  Prize: $${lvl.completionPrize}`, cx, 100 + i * 40 + 16, { color: '#888888', size: 13, align: 'center' });
      }
    }

    drawText('ENTER: Start Race  |  ESC: Back to Garage', cx, ctx.canvas.height - 20, { color: '#555555', size: 13, align: 'center' });
  }
}
