import Phaser from 'phaser';
import { fillBg } from './CanvasUI';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    fillBg();
    this.scene.start('MainMenuScene');
  }
}
