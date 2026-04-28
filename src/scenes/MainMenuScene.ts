import Phaser from 'phaser';
import { ctx } from '@/main';
import { audioManager } from '@/systems';
import { fillBg, drawTitle, drawMenuItem, drawText, centerX } from './CanvasUI';

export class MainMenuScene extends Phaser.Scene {
  private enterKey!: Phaser.Input.Keyboard.Key;
  private blinkTimer = 0;

  constructor() {
    super('MainMenuScene');
  }

  create(): void {
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.blinkTimer = 0;
    this.input.on('pointerdown', () => {
      audioManager.init();
      this.scene.start('GarageScene');
    });
  }

  update(_time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      audioManager.init();
      this.scene.start('GarageScene');
      return;
    }

    this.blinkTimer += delta / 1000;
    fillBg('#0a0a1e');
    drawTitle('ROAD RASH', ctx.canvas.height / 2 - 80, '#ff4444', 48);
    drawTitle('PSEUDO-3D EDITION', ctx.canvas.height / 2 - 30, '#888888', 16);

    drawMenuItem('START GAME', ctx.canvas.height / 2 + 60, true);

    if (Math.floor(this.blinkTimer * 2) % 2 === 0) {
      drawText('Press ENTER to start', centerX(), ctx.canvas.height / 2 + 130, { color: '#aaaaaa', size: 16, align: 'center' });
    }
  }
}
