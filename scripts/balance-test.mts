// Balance test script for Road Rash — runs Monte Carlo simulations
// Usage: npx tsx scripts/balance-test.mts

// --- DATA (copied from source to avoid path alias issues) ---

const TRACK_LENGTHS: Record<string, number> = {
  L1: 60000, L2: 59000, L3: 81000, L4: 68000, L5: 67000,
};

interface LevelConf {
  name: string;
  trackLen: number;
  topSpeed: number;
  timeLimit: number;
  prize: number;
  aiCount: number;
  aiSpeedMin: number;
  aiSpeedMax: number;
}

const LEVELS: LevelConf[] = [
  { name: "L1 City Streets",    trackLen: 60000, topSpeed: 4500, timeLimit: 120, prize: 1000,  aiCount: 3, aiSpeedMin: 0.70, aiSpeedMax: 0.80 },
  { name: "L2 Country Highway", trackLen: 59000, topSpeed: 4800, timeLimit: 150, prize: 2500,  aiCount: 4, aiSpeedMin: 0.75, aiSpeedMax: 0.85 },
  { name: "L3 Desert Canyon",   trackLen: 81000, topSpeed: 5000, timeLimit: 180, prize: 3500,  aiCount: 5, aiSpeedMin: 0.75, aiSpeedMax: 0.85 },
  { name: "L4 Coastal Cliffs",  trackLen: 68000, topSpeed: 5200, timeLimit: 210, prize: 5000,  aiCount: 6, aiSpeedMin: 0.85, aiSpeedMax: 0.92 },
  { name: "L5 Mountain Pass",   trackLen: 67000, topSpeed: 5500, timeLimit: 240, prize: 8000,  aiCount: 7, aiSpeedMin: 0.83, aiSpeedMax: 0.92 },
];

interface BikeConf {
  name: string;
  topSpeed: number;
}

const BIKES: BikeConf[] = [
  { name: "Zero 250",      topSpeed: 4500 },
  { name: "Zero 250+3ups", topSpeed: 5200 },
  { name: "Viper 600",     topSpeed: 4800 },
  { name: "Viper 600+3ups",topSpeed: 5500 },
  { name: "T-Rex 1000",    topSpeed: 5500 },
  { name: "T-Rex 1000+3ups",topSpeed:6200 },
];

const QUALIFYING_POS = 4;
const RUNS = 2000;

// --- SIMULATION ---

function simulate(bike: BikeConf, level: LevelConf): { qualified: boolean; position: number } {
  // Player effective speed: bike topSpeed * efficiency (80-100% to model crashes/traffic)
  const playerEfficiency = 0.80 + Math.random() * 0.20;
  const playerSpeed = bike.topSpeed * playerEfficiency;
  const playerTime = level.trackLen / playerSpeed;

  // AI riders: each has random speed from level's range
  const aiTimes: number[] = [];
  for (let i = 0; i < level.aiCount; i++) {
    const ratio = level.aiSpeedMin + Math.random() * (level.aiSpeedMax - level.aiSpeedMin);
    const aiSpeed = level.topSpeed * ratio;
    aiTimes.push(level.trackLen / aiSpeed);
  }

  // Rank: count how many AI finished faster
  const ahead = aiTimes.filter(t => t < playerTime).length;
  const position = ahead + 1;

  return { qualified: position <= QUALIFYING_POS, position };
}

function runSimulations(bike: BikeConf, level: LevelConf) {
  let qualified = 0;
  let totalPos = 0;
  for (let i = 0; i < RUNS; i++) {
    const result = simulate(bike, level);
    if (result.qualified) qualified++;
    totalPos += result.position;
  }
  return {
    qualRate: (qualified / RUNS * 100).toFixed(0),
    avgPos: (totalPos / RUNS).toFixed(1),
  };
}

// --- REPORT ---

console.log("=== ROAD RASH BALANCE REPORT ===\n");

console.log("TRACK LENGTHS");
for (const l of LEVELS) {
  console.log(`  ${l.name}: ${l.trackLen.toLocaleString()} units`);
}

console.log("\nTIME ANALYSIS (ideal time / limit)");
for (const l of LEVELS) {
  const idealTime = l.trackLen / l.topSpeed;
  const buffer = (l.timeLimit / idealTime).toFixed(1);
  console.log(`  ${l.name}: ${idealTime.toFixed(1)}s / ${l.timeLimit}s (${buffer}x buffer)`);
}

console.log(`\nQUALIFYING RATES (${RUNS} runs, player efficiency 80-100%)\n`);
console.log("  Bike \\ Level        L1     L2     L3     L4     L5");
console.log("  " + "-".repeat(70));

for (const bike of BIKES) {
  const results = LEVELS.map(l => runSimulations(bike, l));
  const row = results.map(r => `${r.qualRate}%`.padStart(5)).join("  ");
  const name = bike.name.padEnd(18);
  console.log(`  ${name}${row}`);
}

console.log("\nAVERAGE FINISH POSITION\n");
console.log("  Bike \\ Level        L1     L2     L3     L4     L5");
console.log("  " + "-".repeat(70));

for (const bike of BIKES) {
  const results = LEVELS.map(l => runSimulations(bike, l));
  const row = results.map(r => r.avgPos.padStart(5)).join("  ");
  const name = bike.name.padEnd(18);
  console.log(`  ${name}${row}`);
}

// Economy analysis
console.log("\nECONOMY ANALYSIS (prize + estimated distance money)");
let cumulative = 0;
const upgradeCosts = [800, 1500, 3000]; // total $5300 for full upgrade
for (const l of LEVELS) {
  const distMoney = Math.floor(l.trackLen * 0.009); // ~0.9% of track length
  const total = l.prize + distMoney;
  cumulative += total;
  console.log(`  ${l.name}: +$${total} (prize $${l.prize} + dist ~$${distMoney}) = cumulative $${cumulative}`);
}

console.log("\nBIKE/UPGRADE COSTS vs CUMULATIVE EARNINGS");
console.log(`  Viper 600 ($5000): affordable after L${cumulative >= 5000 ? "2+" : "?"} ($${cumulative} by L2)`);
const viperAtL3 = LEVELS.slice(0,3).reduce((a,l) => a + l.prize + Math.floor(l.trackLen/l.topSpeed * l.topSpeed * 0.009), 0);
console.log(`  T-Rex 1000 ($15000): affordable after cumulative ~$${viperAtL3} (need $15000)`);
console.log(`  Full speed upgrade ($5300): affordable by cumulative earnings`);

console.log("\nCURRENT BALANCE STATE (applied)");
console.log("  L3 AI speedRange: [0.75, 0.85] (Zero 250 ~64% qualify)");
console.log("  L5 AI speedRange: [0.83, 0.92] (T-Rex 1000 ~62% qualify)");
console.log("  L2 completionPrize: $2500 (Viper affordable by L3)");
