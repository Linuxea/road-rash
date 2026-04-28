export interface ZMapperConfig {
  camHeight: number;
  horizonRatio: number;
  screenWidth: number;
  screenHeight: number;
}

const DEFAULT_CAM_HEIGHT = 1500;
const DEFAULT_HORIZON_RATIO = 0.4;
const DIAGNOSTIC_ROAD_HALF_WIDTH = 2000;

export class ZMapper {
  private config: ZMapperConfig;
  private horizonPx: number;
  private zMap: Float64Array;
  private scaleMap: Float64Array;

  constructor(config: Partial<ZMapperConfig> & { screenWidth: number; screenHeight: number }) {
    this.config = {
      camHeight: config.camHeight ?? DEFAULT_CAM_HEIGHT,
      horizonRatio: Math.min(0.95, Math.max(0.05, config.horizonRatio ?? DEFAULT_HORIZON_RATIO)),
      screenWidth: config.screenWidth,
      screenHeight: config.screenHeight,
    };
    if (this.config.camHeight < 1) throw new Error('camHeight must be >= 1');
    this.horizonPx = 0;
    this.zMap = new Float64Array(0);
    this.scaleMap = new Float64Array(0);
    this.rebuild();
  }

  rebuild(): void {
    const { camHeight, horizonRatio, screenHeight } = this.config;
    this.horizonPx = Math.floor(horizonRatio * screenHeight);

    if (this.zMap.length !== screenHeight) {
      this.zMap = new Float64Array(screenHeight);
      this.scaleMap = new Float64Array(screenHeight);
    }

    for (let y = 0; y < screenHeight; y++) {
      if (y <= this.horizonPx) {
        this.zMap[y] = Infinity;
        this.scaleMap[y] = 0;
      } else {
        const z = camHeight * screenHeight / (y - this.horizonPx);
        this.zMap[y] = z;
        this.scaleMap[y] = 1 / z;
      }
    }
  }

  getZ(screenY: number): number {
    if (screenY < 0 || screenY >= this.config.screenHeight) return Infinity;
    return this.zMap[screenY];
  }

  getScale(screenY: number): number {
    if (screenY < 0 || screenY >= this.config.screenHeight) return 0;
    return this.scaleMap[screenY];
  }

  getRoadPixelWidth(screenY: number, roadHalfWidth: number): number {
    return this.getScale(screenY) * roadHalfWidth * 2;
  }

  getHorizonY(): number {
    return this.horizonPx;
  }

  getScreenHeight(): number {
    return this.config.screenHeight;
  }

  getScreenWidth(): number {
    return this.config.screenWidth;
  }

  getCamHeight(): number {
    return this.config.camHeight;
  }

  updateScreenSize(width: number, height: number): void {
    this.config.screenWidth = width;
    if (height === this.config.screenHeight) return;
    this.config.screenHeight = height;
    this.rebuild();
  }

  updateConfig(partial: Partial<Pick<ZMapperConfig, 'camHeight' | 'horizonRatio'>>): void {
    if (partial.camHeight !== undefined) {
      if (partial.camHeight < 1) throw new Error('camHeight must be >= 1');
      this.config.camHeight = partial.camHeight;
    }
    if (partial.horizonRatio !== undefined) {
      this.config.horizonRatio = Math.min(0.95, Math.max(0.05, partial.horizonRatio));
    }
    this.rebuild();
  }

  dumpDiagnostics(): void {
    const { camHeight, horizonRatio, screenHeight } = this.config;
    const hPx = this.horizonPx;
    const groundH = screenHeight - hPx;

    console.group('[ZMapper] Diagnostics');
    console.log('Config:', { camHeight, horizonRatio, horizonPx: hPx, screenWidth: this.config.screenWidth, screenHeight });

    const samplePoints = [
      hPx,
      hPx + 1,
      Math.floor(hPx + groundH * 0.05),
      Math.floor(hPx + groundH * 0.1),
      Math.floor(hPx + groundH * 0.25),
      Math.floor(hPx + groundH * 0.5),
      Math.floor(hPx + groundH * 0.75),
      screenHeight - 1,
    ];

    console.table(
      samplePoints.map((y) => ({
        screenY: y,
        z: this.getZ(y),
        scale: this.getScale(y),
        roadPxWidth: this.getRoadPixelWidth(y, DIAGNOSTIC_ROAD_HALF_WIDTH),
      }))
    );

    let zMonotonic = true;
    let sMonotonic = true;
    for (let y = hPx + 2; y < screenHeight; y++) {
      if (this.zMap[y] >= this.zMap[y - 1]) zMonotonic = false;
      if (this.scaleMap[y] <= this.scaleMap[y - 1]) sMonotonic = false;
    }
    console.log(`z monotonic decreasing: ${zMonotonic ? 'PASS' : 'FAIL'}`);
    console.log(`scale monotonic increasing: ${sMonotonic ? 'PASS' : 'FAIL'}`);

    const closestZ = this.zMap[screenHeight - 1];
    const farthestZ = this.zMap[hPx + 1];
    console.log(`Depth range: ${closestZ.toFixed(1)} (near) to ${farthestZ.toFixed(1)} (far), ratio: ${(farthestZ / closestZ).toFixed(1)}x`);

    const bottomWidth = this.getRoadPixelWidth(screenHeight - 1, DIAGNOSTIC_ROAD_HALF_WIDTH);
    const quarterWidth = this.getRoadPixelWidth(Math.floor(hPx + groundH * 0.25), DIAGNOSTIC_ROAD_HALF_WIDTH);
    console.log(`Road width: bottom=${bottomWidth.toFixed(0)}px, quarter=${quarterWidth.toFixed(0)}px, ratio=${(bottomWidth / quarterWidth).toFixed(1)}x`);

    console.groupEnd();
  }
}
