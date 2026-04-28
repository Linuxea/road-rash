import './style.css';
import Phaser from 'phaser';
import { BootScene } from '@/scenes/BootScene';
import { MainMenuScene } from '@/scenes/MainMenuScene';
import { GarageScene } from '@/scenes/GarageScene';
import { LevelSelectScene } from '@/scenes/LevelSelectScene';
import { RaceScene } from '@/scenes/RaceScene';
import { ResultScene } from '@/scenes/ResultScene';
import { GameOverScene } from '@/scenes/GameOverScene';

const roadCanvasEl = document.getElementById('road-canvas');
if (!(roadCanvasEl instanceof HTMLCanvasElement)) throw new Error('Missing #road-canvas element');
const roadCanvas = roadCanvasEl;

roadCanvas.width = window.innerWidth;
roadCanvas.height = window.innerHeight;

const ctx = roadCanvas.getContext('2d');
if (!ctx) throw new Error('Failed to get 2D context');
const typedCtx: CanvasRenderingContext2D = ctx;

type ResizeCallback = (width: number, height: number) => void;
const resizeListeners: ResizeCallback[] = [];

export function onRoadCanvasResize(cb: ResizeCallback) {
  resizeListeners.push(cb);
}

export { roadCanvas as roadCanvas, typedCtx as ctx };

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  transparent: true,
  width: window.innerWidth,
  height: window.innerHeight,
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  scene: [BootScene, MainMenuScene, GarageScene, LevelSelectScene, RaceScene, ResultScene, GameOverScene],
};

new Phaser.Game(config);

window.addEventListener('resize', () => {
  roadCanvas.width = window.innerWidth;
  roadCanvas.height = window.innerHeight;
  for (const cb of resizeListeners) cb(roadCanvas.width, roadCanvas.height);
});
