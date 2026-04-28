import Phaser from 'phaser';
import { ZMapper, RoadRenderer, getSegmentAtZ } from '@/road';
import { EntityManager } from '@/entities';
import type { Entity, AttackType, WeaponType } from '@/entities';
import { WEAPON_CONFIGS, FIST_CONFIG } from '@/entities';
import { CombatSystem, audioManager } from '@/systems';
import type { ResultSceneData } from '@/scenes/ResultScene';
import { ctx, onRoadCanvasResize } from '@/main';
import { getOrdinal, drawHUDBar } from './CanvasUI';
import { TouchControls } from './TouchControls';
import { LEVELS } from '@/levels';
import type { LevelConfig } from '@/levels';
import { SaveManager } from '@/save';
import type { SaveData, EffectiveBikeStats } from '@/save';

const LATERAL_SPEED = 2.5;
const ROAD_EDGE = 1.0;
const MAX_OFFROAD_X = 1.3;
const OFFROAD_SPEED_FACTOR = 0.5;
const CURVE_PULL = 0.3;
const CRASH_DURATION = 0.5;   // shake intensity 5 * SHAKE_DECAY_RATE 10 = 0.5s — keep in sync
const CRASH_SPEED_FACTOR = 0.15;
const CRASH_RECOVERY_RATE = 0.6;
const SHAKE_DECAY_RATE = 10;
const PUSH_OFFSET = 0.15;
const PLAYER_MAX_HEALTH = 100;
const PLAYER_KNOCKBACK_DURATION = 1.5;
const PLAYER_INVINCIBLE_DURATION = 2.0;
const HEAT_MAX = 5;
const HEAT_SPEED_RATIO = 0.85;
const HEAT_SPEED_TICK = 10;
const HEAT_DECAY_AMOUNT = 0.5;
const HEAT_DECAY_INTERVAL = 5;
const PRIZE_PER_UNIT = 0.01;
const ESCAPE_REWARD = 500;
const ESCAPE_FLASH_DURATION = 3.0;
const QUALIFYING_POSITION = 4;
const TIMER_WARN = 30;
const TIMER_CRIT = 10;
const SPEED_DISPLAY_RATIO = 0.05;
const HEALTH_WARN_THRESHOLD = 30;
const POST_KNOCKOUT_SPEED_FACTOR = 0.3;
const AI_PUSH_DAMAGE = 5;
const AI_ATTACK_DAMAGE = 10;
const SHAKE_CRASH = 5;
const SHAKE_KNOCKOUT = 8;
const SHAKE_HIT = 3;
const POLICE_BLINK_MS = 400;

export class RaceScene extends Phaser.Scene {
  private zMapper!: ZMapper;
  private roadRenderer!: RoadRenderer;
  private entityManager!: EntityManager;
  private combatSystem!: CombatSystem;
  private levelConfig!: LevelConfig;
  private cameraZ = 0;
  private playerX = 0;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private attackKeys!: {
    z: Phaser.Input.Keyboard.Key;
    x: Phaser.Input.Keyboard.Key;
    space: Phaser.Input.Keyboard.Key;
  };
  private isCrashed = false;
  private crashTimer = 0;
  private shakeIntensity = 0;
  private crashSpeedMultiplier = 1.0;
  private meleeTarget: Entity | null = null;
  private playerHealth = PLAYER_MAX_HEALTH;
  private playerKnockedOut = false;
  private playerKnockbackTimer = 0;
  private playerInvincibleTimer = 0;
  private playerWeapon: WeaponType = 'fist';
  private playerWeaponDurability = Infinity;
  private heatLevel = 0;
  private speedingTimer = 0;
  private heatDecayTimer = 0;
  private fightingThisFrame = false;
  private wasChased = false;
  private isArrested = false;
  private restartKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;
  private money = 0;
  private escapeTimer = 0;
  private hasEscaped = false;
  private escapeFlashTimer = 0;
  private lastArrestFine = 0;
  private static readonly ESCAPE_TIME = 10;
  private static readonly ARREST_FINE_RATIO = 0.3;
  private raceTimer = 0;
  private isRaceFinished = false;
  private finishRank = 0;
  private finishTotal = 0;
  private saveData!: SaveData;
  private bikeStats!: EffectiveBikeStats;
  private playerTopSpeed = 4200;
  private playerHandling = 1.0;
  private currentSpeed = 0;
  private touchControls!: TouchControls;

  constructor() {
    super('RaceScene');
  }

  create(): void {
    const sceneData = this.scene.settings.data as { levelId?: number } | undefined;
    const levelId = Phaser.Math.Clamp(sceneData?.levelId ?? 1, 1, LEVELS.length);
    this.levelConfig = LEVELS[levelId - 1];

    this.saveData = SaveManager.load();
    this.money = this.saveData.money;

    const upgrades = this.saveData.bikeUpgrades[this.saveData.currentBike] ?? { topSpeedLevel: 0, handlingLevel: 0 };
    this.bikeStats = SaveManager.getEffectiveBikeStats(this.saveData.currentBike, upgrades);
    this.playerTopSpeed = this.bikeStats.topSpeed;
    this.playerHandling = this.bikeStats.handling;

    this.raceTimer = this.levelConfig.timeLimit;

    this.zMapper = new ZMapper({
      screenWidth: this.scale.width,
      screenHeight: this.scale.height,
    });
    this.roadRenderer = new RoadRenderer(this.zMapper, ctx, this.levelConfig.trackData);
    this.entityManager = new EntityManager(this.levelConfig);
    this.entityManager.spawnInitial(this.cameraZ);
    this.combatSystem = new CombatSystem();
    audioManager.startEngine();
    audioManager.startMusic();

    const kb = this.input.keyboard!;
    this.cursorKeys = kb.createCursorKeys();
    this.attackKeys = {
      z: kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      x: kb.addKey(Phaser.Input.Keyboard.KeyCodes.X),
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };
    this.restartKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.escKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.zMapper.dumpDiagnostics();

    this.touchControls = new TouchControls(this);
    this.touchControls.layout(ctx.canvas.width, ctx.canvas.height);

    onRoadCanvasResize((w, h) => {
      this.zMapper.updateScreenSize(w, h);
      this.touchControls.layout(w, h);
    });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    if (this.playerKnockedOut) {
      this.currentSpeed = 0;
      this.playerKnockbackTimer -= dt;
      if (!this.isArrested && this.entityManager.isPoliceNear(this.cameraZ, this.playerX)) {
        this.isArrested = true;
        this.touchControls.setArrestMode(true);
        audioManager.playArrested();
        const fine = Math.floor(this.money * RaceScene.ARREST_FINE_RATIO);
        this.lastArrestFine = fine;
        this.money = Math.max(0, this.money - fine);
        this.saveData.money = this.money;
        SaveManager.save(this.saveData);
      }
      if (this.playerKnockbackTimer <= 0) {
        this.playerKnockedOut = false;
        this.playerHealth = PLAYER_MAX_HEALTH;
        this.playerInvincibleTimer = PLAYER_INVINCIBLE_DURATION;
        this.crashSpeedMultiplier = POST_KNOCKOUT_SPEED_FACTOR;
        this.playerWeapon = 'fist';
        this.playerWeaponDurability = Infinity;
      }
      this.applyMotionBlur();
      this.roadRenderer.render(this.cameraZ, this.playerX);
      this.entityManager.render(ctx, this.zMapper, this.cameraZ, this.playerX);
      this.renderAllHUD(ctx);
      if (this.isArrested) {
        this.renderArrestOverlay(ctx);
      }
      this.touchControls.render(ctx);
      this.touchControls.clearFrameState();
      return;
    }

    this.raceTimer -= dt;

    if (this.cameraZ >= this.entityManager.getTrackLength()) {
      this.triggerRaceFinish();
      return;
    }
    if (this.raceTimer <= 0) {
      this.triggerRaceTimeout();
      return;
    }

    if (this.isArrested) {
      if (Phaser.Input.Keyboard.JustDown(this.escKey) || this.touchControls.justDown('esc')) {
        this.scene.start('LevelSelectScene');
        return;
      }
      if (Phaser.Input.Keyboard.JustDown(this.restartKey) || this.touchControls.justDown('restart')) {
        this.isArrested = false;
        this.touchControls.setArrestMode(false);
        this.heatLevel = 0;
        this.wasChased = false;
        this.escapeTimer = 0;
        this.hasEscaped = false;
        this.escapeFlashTimer = 0;
        this.lastArrestFine = 0;
        this.cameraZ = 0;
        this.playerX = 0;
        this.playerHealth = PLAYER_MAX_HEALTH;
        this.money = 0;
        this.crashSpeedMultiplier = 1.0;
        this.playerInvincibleTimer = 0;
        this.isCrashed = false;
        this.entityManager.setPoliceRespawn(true);
        this.entityManager.spawnInitial(this.cameraZ);
      }
      this.applyMotionBlur();
      this.roadRenderer.render(this.cameraZ, this.playerX);
      this.entityManager.render(ctx, this.zMapper, this.cameraZ, this.playerX);
      this.renderAllHUD(ctx);
      this.renderArrestOverlay(ctx);
      this.touchControls.render(ctx);
      this.touchControls.clearFrameState();
      return;
    }

    if (this.isRaceFinished) {
      return;
    }

    if (this.playerInvincibleTimer > 0) {
      this.playerInvincibleTimer -= dt;
    }

    if (this.isCrashed) {
      this.crashTimer -= dt;
      if (this.crashTimer <= 0) {
        this.isCrashed = false;
      }
    }

    if (this.crashSpeedMultiplier < 1.0) {
      this.crashSpeedMultiplier = Math.min(1.0, this.crashSpeedMultiplier + CRASH_RECOVERY_RATE * dt);
    }

    const offroadDepth = Math.max(0, Math.abs(this.playerX) - ROAD_EDGE) / (MAX_OFFROAD_X - ROAD_EDGE);
    const speedFactor = 1.0 - offroadDepth * (1.0 - OFFROAD_SPEED_FACTOR);
    const speed = this.playerTopSpeed * speedFactor * this.crashSpeedMultiplier;
    this.currentSpeed = speed;
    audioManager.updateEngine(this.currentSpeed, this.playerTopSpeed);

    const seg = getSegmentAtZ(this.levelConfig.trackData, this.cameraZ);
    this.playerX -= seg.curve * CURVE_PULL * (speed / this.playerTopSpeed) * dt;

    if (this.cursorKeys.left.isDown || this.touchControls.isDown('left')) this.playerX -= LATERAL_SPEED * this.playerHandling * dt;
    if (this.cursorKeys.right.isDown || this.touchControls.isDown('right')) this.playerX += LATERAL_SPEED * this.playerHandling * dt;

    this.playerX += this.entityManager.getPolicePushForces(this.cameraZ, this.playerX, dt);

    this.playerX = Phaser.Math.Clamp(this.playerX, -MAX_OFFROAD_X, MAX_OFFROAD_X);

    this.cameraZ += speed * dt;
    this.money += speed * dt * PRIZE_PER_UNIT;
    this.entityManager.update(dt, this.cameraZ, this.playerX);
    this.entityManager.setPlayerSpeed(speed);

    const collected = this.entityManager.checkPickupCollection(this.cameraZ, this.playerX);
    if (collected) {
      this.playerWeapon = collected;
      this.playerWeaponDurability = WEAPON_CONFIGS[collected as 'club' | 'chain'].maxDurability;
      audioManager.playPickup();
    }

    const collisions = this.entityManager.checkPlayerCollisions(this.cameraZ, this.playerX);
    for (const col of collisions) {
      if (col.type === 'traffic_crash' && !this.isCrashed) {
        this.isCrashed = true;
        this.crashTimer = CRASH_DURATION;
        this.shakeIntensity = SHAKE_CRASH;
        this.crashSpeedMultiplier = CRASH_SPEED_FACTOR;
        audioManager.playCrash();
      } else if (col.type === 'ai_push') {
        const pushDir = col.entity.laneX > this.playerX ? -1 : 1;
        this.playerX += pushDir * PUSH_OFFSET;
        this.playerX = Phaser.Math.Clamp(this.playerX, -MAX_OFFROAD_X, MAX_OFFROAD_X);
        if (this.playerInvincibleTimer <= 0) {
          this.playerHealth -= AI_PUSH_DAMAGE;
          audioManager.playBump();
          if (this.playerHealth <= 0) {
            this.playerKnockedOut = true;
            this.playerKnockbackTimer = PLAYER_KNOCKBACK_DURATION;
            this.shakeIntensity = SHAKE_KNOCKOUT;
            audioManager.playKnockout();
          }
        }
      }
    }

    const rangeMul = this.playerWeapon === 'fist' ? 1.0 : WEAPON_CONFIGS[this.playerWeapon as 'club' | 'chain'].rangeMultiplier;
    this.meleeTarget = this.entityManager.findMeleeTarget(this.cameraZ, this.playerX, rangeMul);
    this.combatSystem.update(dt);

    if (this.playerInvincibleTimer <= 0 && this.entityManager.checkAIAttacks()) {
      this.playerHealth -= AI_ATTACK_DAMAGE;
      this.shakeIntensity = SHAKE_HIT;
      audioManager.playBump();
      if (this.playerHealth <= 0) {
        this.playerKnockedOut = true;
        this.playerKnockbackTimer = PLAYER_KNOCKBACK_DURATION;
        this.shakeIntensity = 8;
        audioManager.playKnockout();
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.attackKeys.z) || this.touchControls.justDown('punchLeft')) {
      this.performAttack('punch_left');
    } else if (Phaser.Input.Keyboard.JustDown(this.attackKeys.x) || this.touchControls.justDown('punchRight')) {
      this.performAttack('punch_right');
    } else if (Phaser.Input.Keyboard.JustDown(this.attackKeys.space) || this.touchControls.justDown('kick')) {
      this.performAttack('kick');
    }

    // Heat system
    const isSpeeding = speed > HEAT_SPEED_RATIO * this.playerTopSpeed;
    if (isSpeeding) {
      this.speedingTimer += dt;
      if (this.speedingTimer >= HEAT_SPEED_TICK) {
        this.addHeat(1);
        this.speedingTimer -= HEAT_SPEED_TICK;
      }
    } else {
      this.speedingTimer = 0;
    }

    if (!this.fightingThisFrame && !isSpeeding) {
      this.heatDecayTimer += dt;
      if (this.heatDecayTimer >= HEAT_DECAY_INTERVAL) {
        this.addHeat(-HEAT_DECAY_AMOUNT);
        this.heatDecayTimer -= HEAT_DECAY_INTERVAL;
      }
    } else {
      this.heatDecayTimer = 0;
    }
    this.fightingThisFrame = false;

    const policeThreshold = this.levelConfig.police.heatThreshold;

    if (this.heatLevel >= policeThreshold) {
      if (!this.wasChased) audioManager.startSiren();
      this.wasChased = true;
    }

    if (this.wasChased && this.heatLevel < policeThreshold) {
      this.entityManager.setPoliceRespawn(false);
      if (!this.entityManager.hasActivePolice()) {
        this.escapeTimer += dt;
        if (this.escapeTimer >= RaceScene.ESCAPE_TIME && !this.hasEscaped) {
          this.hasEscaped = true;
          this.escapeFlashTimer = ESCAPE_FLASH_DURATION;
          audioManager.stopSiren();
          audioManager.playEscape();
          this.heatLevel = 0;
          this.money += ESCAPE_REWARD;
          this.wasChased = false;
          this.escapeTimer = 0;
          this.entityManager.updatePoliceCount(0, this.cameraZ);
        }
      } else {
        this.escapeTimer = 0;
      }
    } else {
      this.entityManager.setPoliceRespawn(true);
      this.escapeTimer = 0;
    }

    if (this.escapeFlashTimer > 0) {
      this.escapeFlashTimer -= dt;
    }

    this.entityManager.updatePoliceCount(this.heatLevel, this.cameraZ);
    this.entityManager.updatePoliceSpeed(this.heatLevel);

    if (this.shakeIntensity > 0) {
      ctx.save();
      const sx = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      const sy = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      ctx.translate(sx, sy);
    }

    this.applyMotionBlur();
    this.roadRenderer.render(this.cameraZ, this.playerX);
    this.entityManager.render(ctx, this.zMapper, this.cameraZ, this.playerX);
    this.entityManager.renderPickups(ctx, this.zMapper, this.cameraZ, this.playerX);

    if (this.meleeTarget) {
      this.entityManager.renderTargetIndicator(ctx, this.zMapper, this.cameraZ, this.playerX, this.meleeTarget);
    }

    this.combatSystem.render(ctx);

    if (!this.isCrashed) {
      this.roadRenderer.drawMotorcycle(this.bikeStats.color, this.bikeStats.width, this.bikeStats.height);
    }

    if (this.shakeIntensity > 0) {
      ctx.restore();
      this.shakeIntensity = Math.max(0, this.shakeIntensity - SHAKE_DECAY_RATE * dt);
    }

    this.renderWeaponHUD(ctx);
    this.renderHealthHUD(ctx);
    this.renderHeatHUD(ctx);
    this.renderMoneyHUD(ctx);
    this.renderRankHUD(ctx);
    this.renderTimerHUD(ctx);
    this.renderSpeedHUD(ctx);
    this.renderDamageVignette(ctx);

    if (this.escapeFlashTimer > 0) {
      this.renderEscapeFlash(ctx);
    }

    if (this.wasChased && this.escapeTimer > 0) {
      this.renderEscapeProgress(ctx);
    }

    this.touchControls.render(ctx);
    this.touchControls.clearFrameState();
  }

  private performAttack(type: AttackType): void {
    const result = this.combatSystem.tryAttack(
      type,
      this.meleeTarget,
      this.cameraZ,
      this.playerX,
      this.zMapper,
      this.entityManager,
      this.playerWeapon,
    );

    if (result.hit) {
      this.fightingThisFrame = true;
      audioManager.playHit();
      if (this.playerWeapon !== 'fist') {
        this.playerWeaponDurability--;
        if (this.playerWeaponDurability <= 0) {
          this.playerWeapon = 'fist';
          this.playerWeaponDurability = Infinity;
        }
      }

      if (result.disarmedWeapon) {
        this.playerWeapon = result.disarmedWeapon;
        this.playerWeaponDurability = WEAPON_CONFIGS[result.disarmedWeapon as 'club' | 'chain'].maxDurability;
      }

      if (this.meleeTarget && (this.meleeTarget.health ?? 0) <= 0) {
        this.addHeat(this.meleeTarget.type === 'police' ? 4 : 2);
        audioManager.playKnockout();
      } else {
        this.addHeat(1);
      }
    } else if (this.meleeTarget) {
      audioManager.playMiss();
    }
  }

  private renderWeaponHUD(ctx: CanvasRenderingContext2D): void {
    const cfg = this.playerWeapon === 'fist' ? FIST_CONFIG : WEAPON_CONFIGS[this.playerWeapon];
    const x = 16;
    const touchPad = this.touchControls.enabled ? 130 : 0;
    const y = ctx.canvas.height - 60 - touchPad;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x - 4, y - 4, 160, 48);

    ctx.fillStyle = cfg.color;
    ctx.fillRect(x, y + 2, 12, 12);

    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = cfg.color;
    ctx.textAlign = 'left';
    ctx.fillText(cfg.label, x + 18, y + 14);

    if (this.playerWeapon !== 'fist') {
      ctx.font = '14px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`Dur: ${this.playerWeaponDurability}/${cfg.maxDurability}`, x, y + 36);
    }
    ctx.restore();
  }

  private renderHeatHUD(ctx: CanvasRenderingContext2D): void {
    const x = ctx.canvas.width - 160;
    const y = 48;
    const segW = 24;
    const segH = 16;
    const gap = 4;

    ctx.save();
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText('HEAT', x, y);

    for (let i = 0; i < HEAT_MAX; i++) {
      const filled = i < Math.floor(this.heatLevel);
      const partial = i === Math.floor(this.heatLevel) && (this.heatLevel % 1) > 0;
      if (filled) {
        ctx.fillStyle = i < 3 ? '#ffaa00' : '#ff2222';
      } else if (partial) {
        ctx.fillStyle = i < 3 ? 'rgba(255,170,0,0.5)' : 'rgba(255,34,34,0.5)';
      } else {
        ctx.fillStyle = '#333333';
      }
      ctx.fillRect(x + i * (segW + gap), y + 6, segW, segH);
    }

    if (this.heatLevel >= this.levelConfig.police.heatThreshold && Math.floor(Date.now() / POLICE_BLINK_MS) % 2 === 0) {
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#ff2222';
      ctx.fillText('POLICE!', x, y + 36);
    }
    ctx.restore();
  }

  private addHeat(amount: number): void {
    this.heatLevel = Phaser.Math.Clamp(this.heatLevel + amount, 0, HEAT_MAX);
  }

  private renderArrestOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.font = 'bold 48px monospace';
    ctx.fillStyle = '#ff2222';
    ctx.textAlign = 'center';
    ctx.fillText('ARRESTED', ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.font = '20px monospace';
    ctx.fillStyle = '#ffaa00';
    ctx.fillText(`Fine: -$${this.lastArrestFine}`, ctx.canvas.width / 2, ctx.canvas.height / 2 + 40);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Remaining: $${Math.floor(this.money)}`, ctx.canvas.width / 2, ctx.canvas.height / 2 + 65);
    ctx.fillText('Press R to restart  |  ESC to quit', ctx.canvas.width / 2, ctx.canvas.height / 2 + 100);
  }

  private renderMoneyHUD(ctx: CanvasRenderingContext2D): void {
    const x = 16;
    const y = 16;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x - 4, y - 4, 140, 28);
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#44ff44';
    ctx.textAlign = 'left';
    ctx.fillText(`$${Math.floor(this.money)}`, x, y + 16);
    ctx.restore();
  }

  private renderEscapeFlash(ctx: CanvasRenderingContext2D): void {
    const alpha = Math.min(1, this.escapeFlashTimer / ESCAPE_FLASH_DURATION);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = '#44ff44';
    ctx.textAlign = 'center';
    ctx.fillText('ESCAPED!', ctx.canvas.width / 2, ctx.canvas.height / 2 - 20);
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#ffff44';
    ctx.fillText(`+$${ESCAPE_REWARD}`, ctx.canvas.width / 2, ctx.canvas.height / 2 + 20);
    ctx.restore();
  }

  private renderEscapeProgress(ctx: CanvasRenderingContext2D): void {
    const progress = this.escapeTimer / RaceScene.ESCAPE_TIME;
    const barW = 160;
    const barH = 8;
    const x = ctx.canvas.width / 2 - barW / 2;
    const y = ctx.canvas.height / 2 + 60;

    ctx.save();
    ctx.fillStyle = '#333333';
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = '#44ff44';
    ctx.fillRect(x, y, barW * progress, barH);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('ESCAPING...', ctx.canvas.width / 2, y - 4);
    ctx.restore();
  }

  private calculateRank(): { position: number; total: number } {
    const riders = this.entityManager.getAIRiders();
    const tl = this.entityManager.getTrackLength();
    const ahead = riders.filter(e => {
      let dz = e.worldZ - this.cameraZ;
      if (dz < -tl / 2) dz += tl;
      if (dz > tl / 2) dz -= tl;
      return dz > 0;
    }).length;
    return { position: ahead + 1, total: riders.length + 1 };
  }

  private endRace(qualified: boolean, prize: number, timeOut: boolean): void {
    this.isRaceFinished = true;
    audioManager.stopAll();
    const { position, total } = this.calculateRank();
    this.finishRank = position;
    this.finishTotal = total;
    this.money += prize;

    this.saveData.money = this.money;
    if (qualified) {
      const nextId = this.levelConfig.id + 1;
      if (nextId <= LEVELS.length && !this.saveData.unlockedLevels.includes(nextId)) {
        this.saveData.unlockedLevels.push(nextId);
      }
      const elapsed = this.levelConfig.timeLimit - this.raceTimer;
      const prev = this.saveData.bestTimes[this.levelConfig.id];
      if (prev === undefined || elapsed < prev) {
        this.saveData.bestTimes[this.levelConfig.id] = elapsed;
      }
    }
    SaveManager.save(this.saveData);

    audioManager.playRaceFinish(qualified);

    this.scene.start('ResultScene', {
      levelId: this.levelConfig.id,
      rank: this.finishRank,
      total: this.finishTotal,
      prize,
      qualified,
      money: this.money,
      timeOut,
    } satisfies ResultSceneData);
  }

  private triggerRaceFinish(): void {
    const qualified = this.calculateRank().position <= QUALIFYING_POSITION;
    const prize = qualified ? this.levelConfig.completionPrize : 0;
    this.endRace(qualified, prize, false);
  }

  private triggerRaceTimeout(): void {
    this.endRace(false, 0, true);
  }

  private renderRankHUD(ctx: CanvasRenderingContext2D): void {
    const { position, total } = this.calculateRank();
    const x = ctx.canvas.width - 160;
    const y = 16;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x - 4, y - 4, 152, 28);
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = position <= QUALIFYING_POSITION ? '#44ff44' : '#ff4444';
    ctx.textAlign = 'left';
    ctx.fillText(`${getOrdinal(position)} / ${total}`, x, y + 16);
    ctx.restore();
  }

  private renderTimerHUD(ctx: CanvasRenderingContext2D): void {
    const t = Math.max(0, this.raceTimer);
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    const x = 16;
    const y = 44;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x - 4, y - 4, 100, 28);
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';

    if (t < TIMER_CRIT) {
      ctx.fillStyle = Math.floor(t * 4) % 2 === 0 ? '#ff2222' : '#ff8888';
    } else if (t < TIMER_WARN) {
      ctx.fillStyle = '#ffaa00';
    } else {
      ctx.fillStyle = '#ffffff';
    }
    ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, x, y + 16);
    ctx.restore();
  }

  private renderAllHUD(c: CanvasRenderingContext2D): void {
    this.renderWeaponHUD(c);
    this.renderHealthHUD(c);
    this.renderHeatHUD(c);
    this.renderMoneyHUD(c);
    this.renderRankHUD(c);
    this.renderTimerHUD(c);
    this.renderSpeedHUD(c);
    this.renderDamageVignette(c);
  }

  private renderSpeedHUD(c: CanvasRenderingContext2D): void {
    const x = c.canvas.width - 160;
    const touchPad = this.touchControls.enabled ? 130 : 0;
    const y = c.canvas.height - 80 - touchPad;
    const kmh = Math.round(this.currentSpeed * SPEED_DISPLAY_RATIO);

    c.save();
    c.fillStyle = 'rgba(0, 0, 0, 0.6)';
    c.fillRect(x - 4, y - 4, 148, 64);

    c.font = '12px monospace';
    c.fillStyle = '#aaaaaa';
    c.textAlign = 'right';
    c.fillText('km/h', x + 138, y + 12);

    c.font = 'bold 32px monospace';
    c.textAlign = 'right';
    const speedRatio = this.currentSpeed / this.playerTopSpeed;
    c.fillStyle = speedRatio > 0.85 ? '#ffaa00' : speedRatio > 0.3 ? '#ffffff' : '#666666';
    c.fillText(`${kmh}`, x + 138, y + 48);
    c.restore();
  }

  private renderHealthHUD(c: CanvasRenderingContext2D): void {
    const x = 16;
    const touchPad = this.touchControls.enabled ? 130 : 0;
    const y = c.canvas.height - 110 - touchPad;
    const ratio = this.playerHealth / PLAYER_MAX_HEALTH;

    c.save();
    c.fillStyle = 'rgba(0, 0, 0, 0.6)';
    c.fillRect(x - 4, y - 4, 160, 44);

    c.font = 'bold 14px monospace';
    c.fillStyle = '#ffffff';
    c.textAlign = 'left';
    c.fillText('HP', x, y + 12);

    drawHUDBar(c, x + 28, y + 2, 96, 12, ratio);

    c.font = '12px monospace';
    c.fillStyle = '#cccccc';
    c.fillText(`${this.playerHealth}/${PLAYER_MAX_HEALTH}`, x, y + 36);
    c.restore();
  }

  private renderDamageVignette(c: CanvasRenderingContext2D): void {
    if (this.playerHealth >= HEALTH_WARN_THRESHOLD) return;
    const intensity = (HEALTH_WARN_THRESHOLD - this.playerHealth) / HEALTH_WARN_THRESHOLD;
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
    const alpha = intensity * (0.15 + 0.1 * pulse);

    c.save();
    const w = c.canvas.width;
    const h = c.canvas.height;
    const grad = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
    grad.addColorStop(0, 'rgba(255, 0, 0, 0)');
    grad.addColorStop(1, `rgba(255, 0, 0, ${alpha})`);
    c.fillStyle = grad;
    c.fillRect(0, 0, w, h);
    c.restore();
  }

  shutdown(): void {
    audioManager.stopAll();
  }

  private applyMotionBlur(): void {
    const ratio = this.currentSpeed / this.playerTopSpeed;
    const alpha = ratio > 0.5 ? 0.05 + 0.15 * ((ratio - 0.5) / 0.5) : 0;
    this.roadRenderer.setMotionBlurAlpha(alpha);
  }

}
