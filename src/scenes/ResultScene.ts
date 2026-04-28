import Phaser from 'phaser';
import { ctx } from '@/main';
import { LEVELS } from '@/levels';
import { fillBg, drawTitle, drawText, drawMenuItem, centerX, getOrdinal } from './CanvasUI';

export interface ResultSceneData {
  levelId: number;
  rank: number;
  total: number;
  prize: number;
  qualified: boolean;
  money: number;
  timeOut: boolean;
}

export class ResultScene extends Phaser.Scene {
  private result!: ResultSceneData;
  private sel = 0;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private enterKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('ResultScene');
  }

  create(): void {
    this.result = this.scene.settings.data as ResultSceneData;
    this.sel = 0;

    const kb = this.input.keyboard!;
    this.cursorKeys = kb.createCursorKeys();
    this.enterKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const h = this.scale.height;
      if (p.y < h * 0.4) {
        this.sel = Math.max(0, this.sel - 1);
      } else if (p.y > h * 0.6) {
        this.sel = Math.min(this.getOptionCount() - 1, this.sel + 1);
      } else {
        this.handleAction();
      }
    });
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.cursorKeys.up)) {
      this.sel = Math.max(0, this.sel - 1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursorKeys.down)) {
      this.sel = Math.min(this.getOptionCount() - 1, this.sel + 1);
    }

    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      this.handleAction();
    }

    this.render();
  }

  private getOptionCount(): number {
    if (this.result.qualified) {
      const allDone = this.result.levelId >= LEVELS.length;
      return allDone ? 2 : 3;
    }
    return 2;
  }

  private handleAction(): void {
    if (this.result.qualified) {
      const allDone = this.result.levelId >= LEVELS.length;
      if (allDone) {
        if (this.sel === 0) this.scene.start('GameOverScene');
        else this.scene.start('GarageScene');
      } else {
        if (this.sel === 0) {
          this.scene.start('RaceScene', { levelId: this.result.levelId + 1 });
        } else if (this.sel === 1) {
          this.scene.start('LevelSelectScene');
        } else {
          this.scene.start('GarageScene');
        }
      }
    } else {
      if (this.sel === 0) {
        this.scene.start('RaceScene', { levelId: this.result.levelId });
      } else {
        this.scene.start('LevelSelectScene');
      }
    }
  }

  private render(): void {
    fillBg('#0a0a1e');

    const cx = centerX();
    const lvl = LEVELS[this.result.levelId - 1];
    drawTitle(lvl?.name ?? 'RACE RESULTS', 40);

    const y0 = 100;
    if (this.result.qualified) {
      drawText('RACE COMPLETE', cx, y0, { color: '#44ff44', size: 28, align: 'center' });
    } else {
      drawText(this.result.timeOut ? "TIME'S UP" : 'ELIMINATED', cx, y0, { color: '#ff4444', size: 28, align: 'center' });
    }

    const ordinal = getOrdinal(this.result.rank);
    drawText(`${ordinal} / ${this.result.total}`, cx, y0 + 50, { color: '#ffcc00', size: 36, align: 'center' });

    if (this.result.prize > 0) {
      drawText(`Prize: +$${this.result.prize}`, cx, y0 + 100, { color: '#44ff44', size: 22, align: 'center' });
    }
    drawText(`Total: $${Math.floor(this.result.money)}`, cx, y0 + 135, { color: '#ffffff', size: 20, align: 'center' });

    const optY = y0 + 200;
    let row = 0;

    if (this.result.qualified) {
      const allDone = this.result.levelId >= LEVELS.length;
      if (allDone) {
        drawMenuItem('VIEW ENDING', optY + row * 40, this.sel === row);
        row++;
        drawMenuItem('GO TO GARAGE', optY + row * 40, this.sel === row);
      } else {
        drawMenuItem('NEXT RACE', optY + row * 40, this.sel === row);
        row++;
        drawMenuItem('LEVEL SELECT', optY + row * 40, this.sel === row);
        row++;
        drawMenuItem('GO TO GARAGE', optY + row * 40, this.sel === row);
      }
    } else {
      drawMenuItem('RETRY', optY + row * 40, this.sel === row);
      row++;
      drawMenuItem('LEVEL SELECT', optY + row * 40, this.sel === row);
    }

    drawText('ENTER: Select  |  UP/DOWN: Choose', cx, ctx.canvas.height - 20, { color: '#555555', size: 13, align: 'center' });
  }
}
