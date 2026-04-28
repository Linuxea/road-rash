import type { ZMapper } from './ZMapper';
import type { TrackData } from './types';
import { getSegmentAtZ } from './testTrack';
import { ROAD_HALF_WIDTH, CURVE_SEGMENT_FACTOR, HILL_SEGMENT_FACTOR } from './types';

const SKY_COLOR = '#1a1a2e';
const GRASS_COLOR = '#1e3a1e';
const ROAD_DARK = '#404040';
const ROAD_LIGHT = '#505050';
const EDGE_COLOR = '#ffffff';

// Parsed RGB for fog interpolation
const SKY_R = 0x1a, SKY_G = 0x1a, SKY_B = 0x2e;
const GRASS_R = 0x1e, GRASS_G = 0x3a, GRASS_B = 0x1e;
const RD_DARK_R = 0x40, RD_DARK_G = 0x40, RD_DARK_B = 0x40;
const RD_LIGHT_R = 0x50, RD_LIGHT_G = 0x50, RD_LIGHT_B = 0x50;

const FOG_START_Z = 5000;
const FOG_FULL_Z = 20000;

const DEFAULT_STRIPE_LENGTH = 3000;
const MOTO_WIDTH = 40;
const MOTO_HEIGHT = 60;
const MOTO_BOTTOM_PADDING = 10;

export class RoadRenderer {
  private zMapper: ZMapper;
  private ctx: CanvasRenderingContext2D;
  private trackData: TrackData;
  private roadHalfWidth: number;
  private stripeLength: number;
  private curveOffsetMap: Float64Array;
  private hillOffsetMap: Float64Array;
  private motionBlurAlpha = 0;

  constructor(
    zMapper: ZMapper,
    ctx: CanvasRenderingContext2D,
    trackData: TrackData,
    roadHalfWidth = ROAD_HALF_WIDTH,
    stripeLength = DEFAULT_STRIPE_LENGTH,
  ) {
    this.zMapper = zMapper;
    this.ctx = ctx;
    this.trackData = trackData;
    this.roadHalfWidth = roadHalfWidth;
    this.stripeLength = stripeLength;
    this.curveOffsetMap = new Float64Array(0);
    this.hillOffsetMap = new Float64Array(0);
  }

  setMotionBlurAlpha(alpha: number): void {
    this.motionBlurAlpha = alpha;
  }

  render(cameraZ: number, playerX: number): void {
    const { ctx, zMapper, roadHalfWidth, stripeLength, trackData } = this;
    const screenWidth = zMapper.getScreenWidth();
    const screenHeight = zMapper.getScreenHeight();
    const horizonY = zMapper.getHorizonY();
    const baseCenterX = screenWidth / 2;

    if (this.curveOffsetMap.length !== screenHeight) {
      this.curveOffsetMap = new Float64Array(screenHeight);
      this.hillOffsetMap = new Float64Array(screenHeight);
    }

    let curveX = 0;
    let hillY = 0;
    for (let y = screenHeight - 1; y > horizonY; y--) {
      const z = zMapper.getZ(y);
      const worldZ = cameraZ + z;
      const seg = getSegmentAtZ(trackData, worldZ);
      curveX += seg.curve * CURVE_SEGMENT_FACTOR;
      hillY += seg.hill * HILL_SEGMENT_FACTOR;
      this.curveOffsetMap[y] = curveX;
      this.hillOffsetMap[y] = hillY;
    }

    // Sky — always fully opaque
    ctx.fillStyle = SKY_COLOR;
    ctx.fillRect(0, 0, screenWidth, horizonY + 1);

    // Ground area — motion blur preserves previous frame, otherwise full clear
    if (this.motionBlurAlpha > 0.001) {
      // Semi-transparent overlay lets previous frame's entities bleed through
      ctx.fillStyle = `rgba(0,0,0,${this.motionBlurAlpha.toFixed(3)})`;
      ctx.fillRect(0, horizonY + 1, screenWidth, screenHeight - horizonY - 1);
    } else {
      ctx.fillStyle = SKY_COLOR;
      ctx.fillRect(0, horizonY + 1, screenWidth, screenHeight - horizonY - 1);
    }

    // When blur is active, draw scanlines with reduced opacity so trails show through
    const blurActive = this.motionBlurAlpha > 0.001;
    if (blurActive) {
      ctx.save();
      ctx.globalAlpha = 1 - this.motionBlurAlpha * 0.5;
    }

    for (let y = horizonY + 1; y < screenHeight; y++) {
      const scale = zMapper.getScale(y);
      const z = zMapper.getZ(y);
      const halfRoadPx = scale * roadHalfWidth;
      const hillShift = this.hillOffsetMap[y] * scale;
      const drawY = Math.round(y + hillShift);
      const centerX = baseCenterX + (this.curveOffsetMap[y] - playerX) * halfRoadPx;
      const leftEdge = centerX - halfRoadPx;
      const rightEdge = centerX + halfRoadPx;

      // Fog factor from depth
      const fogFactor = z >= FOG_FULL_Z ? 1.0
        : z <= FOG_START_Z ? 0.0
        : (z - FOG_START_Z) / (FOG_FULL_Z - FOG_START_Z);

      // Grass with fog
      if (fogFactor > 0) {
        const r = Math.round(GRASS_R + (SKY_R - GRASS_R) * fogFactor);
        const g = Math.round(GRASS_G + (SKY_G - GRASS_G) * fogFactor);
        const b = Math.round(GRASS_B + (SKY_B - GRASS_B) * fogFactor);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else {
        ctx.fillStyle = GRASS_COLOR;
      }
      ctx.fillRect(0, drawY, screenWidth, 1);

      // Road with fog
      const stripe = Math.floor((z + cameraZ) / stripeLength) % 2;
      if (fogFactor > 0) {
        const br = stripe === 0 ? RD_DARK_R : RD_LIGHT_R;
        const bg = stripe === 0 ? RD_DARK_G : RD_LIGHT_G;
        const bb = stripe === 0 ? RD_DARK_B : RD_LIGHT_B;
        const r = Math.round(br + (SKY_R - br) * fogFactor);
        const g = Math.round(bg + (SKY_G - bg) * fogFactor);
        const b = Math.round(bb + (SKY_B - bb) * fogFactor);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else {
        ctx.fillStyle = stripe === 0 ? ROAD_DARK : ROAD_LIGHT;
      }
      ctx.fillRect(leftEdge, drawY, rightEdge - leftEdge, 1);

      // Edge lines — skip when foggy
      if (halfRoadPx > 1 && fogFactor < 0.6) {
        ctx.fillStyle = EDGE_COLOR;
        ctx.fillRect(leftEdge, drawY, 2, 1);
        ctx.fillRect(rightEdge - 2, drawY, 2, 1);
      }
    }

    if (blurActive) {
      ctx.restore();
    }
  }

  drawMotorcycle(color = '#ff4444', w = MOTO_WIDTH, h = MOTO_HEIGHT): void {
    const { ctx, zMapper } = this;
    const screenWidth = zMapper.getScreenWidth();
    const screenHeight = zMapper.getScreenHeight();
    ctx.fillStyle = color;
    ctx.fillRect(
      (screenWidth - w) / 2,
      screenHeight - h - MOTO_BOTTOM_PADDING,
      w,
      h,
    );
  }
}
