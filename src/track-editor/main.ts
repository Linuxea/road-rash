import { ZMapper, RoadRenderer, buildTrackData, getSegmentAtZ } from '@/road';
import type { TrackDescription, TrackData } from '@/road';
import { LEVEL1_TRACK, LEVEL2_TRACK, LEVEL3_TRACK, LEVEL4_TRACK, LEVEL5_TRACK } from '@/levels';

const LEVEL_TRACKS: Record<number, TrackDescription[]> = {
  1: LEVEL1_TRACK, 2: LEVEL2_TRACK, 3: LEVEL3_TRACK, 4: LEVEL4_TRACK, 5: LEVEL5_TRACK,
};

const canvas = document.getElementById('preview-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const textarea = document.getElementById('track-json') as HTMLTextAreaElement;
const errorDiv = document.getElementById('error-msg')!;
const speedSlider = document.getElementById('speed-slider') as HTMLInputElement;
const speedVal = document.getElementById('speed-val')!;
const cameraZInput = document.getElementById('camera-z') as HTMLInputElement;
const infoSegs = document.getElementById('info-segs')!;
const infoLen = document.getElementById('info-len')!;
const infoCur = document.getElementById('info-cur')!;
const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;

let zMapper: ZMapper;
let roadRenderer: RoadRenderer;
let trackData: TrackData;
let trackDescs: TrackDescription[] = [];
let cameraZ = 0;
let driveSpeed = 2000;
let isPlaying = true;
let lastFrameTime = 0;

function resizeCanvas(): void {
  const preview = document.getElementById('preview')!;
  canvas.width = preview.clientWidth;
  canvas.height = preview.clientHeight;
  zMapper = new ZMapper({ screenWidth: canvas.width, screenHeight: canvas.height });
  rebuildRenderer();
}

function rebuildRenderer(): void {
  roadRenderer = new RoadRenderer(zMapper, ctx, trackData);
}

function totalLength(): number {
  return trackDescs.reduce((sum, s) => sum + s.length, 0);
}

function updateInfo(): void {
  infoSegs.textContent = String(trackDescs.length);
  infoLen.textContent = totalLength().toLocaleString();
  const tl = totalLength();
  if (tl > 0) {
    const seg = getSegmentAtZ(trackData, cameraZ);
    infoCur.textContent = `curve=${seg.curve} hill=${seg.hill}`;
  }
}

function parseAndUpdate(): void {
  try {
    const parsed = JSON.parse(textarea.value);
    if (!Array.isArray(parsed)) throw new Error('Must be a JSON array');
    for (let i = 0; i < parsed.length; i++) {
      const s = parsed[i];
      if (typeof s.length !== 'number' || typeof s.curve !== 'number' || typeof s.hill !== 'number') {
        throw new Error(`Segment ${i}: needs numeric length, curve, hill`);
      }
      if (s.length <= 0) throw new Error(`Segment ${i}: length must be positive`);
    }
    const newDescs = parsed as TrackDescription[];
    const newData = buildTrackData(newDescs);
    // Atomic update: only assign if buildTrackData succeeded
    trackDescs = newDescs;
    trackData = newData;
    rebuildRenderer();
    errorDiv.textContent = '';
    updateInfo();
  } catch (e) {
    errorDiv.textContent = (e as Error).message;
  }
}

function setJson(descriptions: TrackDescription[]): void {
  textarea.value = JSON.stringify(descriptions, null, 2);
  parseAndUpdate();
}

function renderFrame(timestamp: number): void {
  const dt = lastFrameTime === 0 ? 0 : Math.min((timestamp - lastFrameTime) / 1000, 0.05);
  lastFrameTime = timestamp;

  if (isPlaying) {
    cameraZ += driveSpeed * dt;
    const tl = totalLength();
    if (tl > 0 && cameraZ >= tl) cameraZ -= tl;
  }

  if (trackData.length === 0) {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#ff4444';
    ctx.textAlign = 'center';
    ctx.fillText('Empty track — add segments', canvas.width / 2, canvas.height / 2);
  } else {
    roadRenderer.render(cameraZ, 0);
  }
  cameraZInput.value = String(Math.floor(cameraZ));
  updateInfo();

  requestAnimationFrame(renderFrame);
}

// Init
textarea.value = JSON.stringify(LEVEL3_TRACK, null, 2);
trackDescs = [...LEVEL3_TRACK];
trackData = buildTrackData(trackDescs);

canvas.width = 1; canvas.height = 1;
zMapper = new ZMapper({ screenWidth: 1, screenHeight: 1 });
roadRenderer = new RoadRenderer(zMapper, ctx, trackData);
resizeCanvas();

// Events
let debounceTimer: ReturnType<typeof setTimeout>;
textarea.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(parseAndUpdate, 300);
});

document.getElementById('btn-add')!.addEventListener('click', () => {
  try {
    const arr = JSON.parse(textarea.value);
    arr.push({ length: 5000, curve: 0, hill: 0 });
    setJson(arr);
  } catch { /* ignore parse error during add */ }
});

document.getElementById('btn-del')!.addEventListener('click', () => {
  try {
    const arr = JSON.parse(textarea.value);
    if (arr.length > 0) { arr.pop(); setJson(arr); }
  } catch { /* ignore */ }
});

document.querySelectorAll('[data-level]').forEach(btn => {
  btn.addEventListener('click', () => {
    const level = Number((btn as HTMLElement).dataset.level);
    const track = LEVEL_TRACKS[level];
    if (track) setJson(track);
  });
});

speedSlider.addEventListener('input', () => {
  driveSpeed = Number(speedSlider.value);
  speedVal.textContent = String(driveSpeed);
});

cameraZInput.addEventListener('input', () => {
  cameraZ = Number(cameraZInput.value);
});

btnPlay.addEventListener('click', () => {
  isPlaying = !isPlaying;
  btnPlay.textContent = isPlaying ? 'Pause' : 'Play';
});

document.getElementById('btn-reset')!.addEventListener('click', () => {
  cameraZ = 0;
});

window.addEventListener('resize', resizeCanvas);

requestAnimationFrame(renderFrame);
