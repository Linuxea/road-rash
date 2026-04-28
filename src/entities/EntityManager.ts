import type { Entity, CollisionResult, WeaponPickup, WeaponType } from './types';
import { WEAPON_CONFIGS, POLICE_RIDER_COLOR, POLICE_MOTO_COLOR, AI_MAX_HEALTH } from './types';
import type { ZMapper } from '@/road/ZMapper';
import type { TrackData } from '@/road/types';
import { SEGMENT_LENGTH, ROAD_HALF_WIDTH, CURVE_SEGMENT_FACTOR, HILL_SEGMENT_FACTOR } from '@/road/types';
import { getSegmentAtZ } from '@/road/testTrack';
import type { LevelConfig } from '@/levels';
import { AIRiderBehavior } from './AIRiderBehavior';

const DRAW_DISTANCE = 20000;
const OBSTACLE_Z_RANGE = 3000;
const OBSTACLE_X_RANGE = 0.5;
const HIT_DEPTH = 400;
const HIT_WIDTH = 0.3;
const COLLISION_COOLDOWN = 1.5;
const MELEE_DEPTH = 800;
const MELEE_WIDTH = 0.6;
const KNOCKBACK_DURATION = 1.5;
const KNOCKBACK_DRIFT_SPEED = 3.0;
const RESPAWN_BEHIND_DISTANCE = 3000;
const PICKUP_SPAWN_MIN = 8;
const PICKUP_SPAWN_MAX = 15;
const PICKUP_DEPTH = 10000;
const MAX_PICKUPS = 3;
const PICKUP_HIT_DEPTH = 400;
const PICKUP_HIT_WIDTH = 0.4;
const AI_ATTACK_RANGE = 800;
const POLICE_SPAWN_BEHIND = 2000;
const ARREST_Z_RANGE = 600;
const AI_SPAWN_START = 3000;
const AI_SPAWN_SPACING = 2500;
const AI_SPAWN_JITTER = 1000;
const TRAFFIC_SPAWN_START = 5000;
const TRAFFIC_SPAWN_SPACING = 5000;
const TRAFFIC_SPAWN_JITTER = 2000;
const POLICE_DESPAWN_DISTANCE = 3000;
const POLICE_REPOSITION_DISTANCE = 1500;
const AI_FALLBACK_SPEED = 4000;
const AI_RESPAWN_SPEED_RATIO = 0.5;
const TRAFFIC_RESPAWN_SPEED = 2800;
const RESPAWN_DEPTH_MIN_RATIO = 0.4;
const RESPAWN_DEPTH_RANGE_RATIO = 0.5;
const RESPAWN_LANE_RANGE = 1.4;
const RIDER_WIDTH = 800;
const RIDER_HEIGHT = 1200;
const RIDER_HEIGHT_RATIO = 0.4;

export class EntityManager {
  private entities: Entity[];
  private trackData: TrackData;
  private trackLength: number;
  private aiBehaviors: Map<Entity, AIRiderBehavior>;
  private collisionCooldowns: Map<Entity, number>;
  private playerMaxSpeed: number;
  private playerCurrentSpeed: number;
  private weaponPickups: WeaponPickup[];
  private pickupSpawnTimer: number;
  private policeShouldRespawn = true;
  private levelConfig: LevelConfig;

  constructor(levelConfig: LevelConfig) {
    this.levelConfig = levelConfig;
    this.trackData = levelConfig.trackData;
    this.trackLength = levelConfig.trackData.length * SEGMENT_LENGTH;
    this.playerMaxSpeed = levelConfig.topSpeed;
    this.playerCurrentSpeed = levelConfig.topSpeed;
    this.entities = [];
    this.aiBehaviors = new Map();
    this.collisionCooldowns = new Map();
    this.weaponPickups = [];
    this.pickupSpawnTimer = PICKUP_SPAWN_MIN;
  }

  spawnInitial(cameraZ: number): void {
    this.entities = [];
    this.aiBehaviors.clear();
    this.collisionCooldowns.clear();
    this.weaponPickups = [];
    this.pickupSpawnTimer = PICKUP_SPAWN_MIN;
    this.policeShouldRespawn = true;

    const mk = (type: Entity['type'], wz: number, lx: number, sp: number, w: number, h: number, c: string, mc: string): Entity =>
      ({ type, worldZ: cameraZ + wz, laneX: lx, speed: sp, width: w, height: h, color: c, motoColor: mc });

    const { aiRiders, traffic } = this.levelConfig;

    for (let i = 0; i < aiRiders.count; i++) {
      const [riderColor, motoColor] = aiRiders.colors[i % aiRiders.colors.length];
      const ratio = aiRiders.speedRange[0] + Math.random() * (aiRiders.speedRange[1] - aiRiders.speedRange[0]);
      const speed = this.playerMaxSpeed * ratio;
      const laneX = (Math.random() - 0.5) * 1.0;
      const wz = AI_SPAWN_START + i * AI_SPAWN_SPACING + Math.random() * AI_SPAWN_JITTER;
      const e = mk('ai_rider', wz, laneX, speed, RIDER_WIDTH, RIDER_HEIGHT, riderColor, motoColor);
      e.health = AI_MAX_HEALTH;
      if (Math.random() < aiRiders.weaponChance && aiRiders.weaponPool.length > 0) {
        e.weapon = aiRiders.weaponPool[Math.floor(Math.random() * aiRiders.weaponPool.length)];
      }
      e.targetSpeed = speed;
      this.entities.push(e);
      this.aiBehaviors.set(e, new AIRiderBehavior(e));
    }

    for (let i = 0; i < traffic.count; i++) {
      const [carColor, carMoto] = traffic.colors[i % traffic.colors.length];
      const speed = traffic.speedRange[0] + Math.random() * (traffic.speedRange[1] - traffic.speedRange[0]);
      const laneX = (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.4);
      const wz = TRAFFIC_SPAWN_START + i * TRAFFIC_SPAWN_SPACING + Math.random() * TRAFFIC_SPAWN_JITTER;
      const e = mk('traffic', wz, laneX, speed, 1200, 1000, carColor, carMoto);
      this.entities.push(e);
    }
  }

  update(dt: number, cameraZ: number, playerX: number): void {
    for (const [entity, remaining] of this.collisionCooldowns) {
      const updated = remaining - dt;
      if (updated <= 0) {
        this.collisionCooldowns.delete(entity);
      } else {
        this.collisionCooldowns.set(entity, updated);
      }
    }

    const toRemove: Entity[] = [];

    for (const e of this.entities) {
      if (e.knockedOut) {
        e.knockbackTimer = (e.knockbackTimer ?? 0) - dt;
        e.laneX += Math.sign(e.laneX || 1) * KNOCKBACK_DRIFT_SPEED * dt;
        e.speed = 0;

        if (e.knockbackTimer <= 0) {
          if (e.type === 'police' && !this.policeShouldRespawn) {
            toRemove.push(e);
          } else {
            this.respawnBehind(e, cameraZ);
          }
        }
        continue;
      }

      if ((e.type === 'ai_rider' || e.type === 'police') && e.health !== undefined && e.health <= 0 && !e.knockedOut) {
        e.knockedOut = true;
        e.knockbackTimer = e.type === 'police' ? this.levelConfig.police.knockbackDuration : KNOCKBACK_DURATION;
        e.speed = 0;
        continue;
      }

      if (e.type === 'police') {
        const pc = this.levelConfig.police;
        const target = e.targetSpeed ?? this.playerCurrentSpeed * 1.1;
        if (e.speed < target) {
          e.speed = Math.min(e.speed + pc.acceleration * dt, target);
        }
        e.worldZ += e.speed * dt;
        if (e.worldZ > this.trackLength) e.worldZ -= this.trackLength;

        const dx = playerX - e.laneX;
        e.laneX += Math.sign(dx) * Math.min(Math.abs(dx), pc.lateralSpeed * dt);

        const dz = e.worldZ - cameraZ;
        if (dz < -POLICE_DESPAWN_DISTANCE) {
          e.worldZ = cameraZ - POLICE_REPOSITION_DISTANCE;
        }
        continue;
      }

      e.worldZ += e.speed * dt;

      if (e.worldZ > this.trackLength) e.worldZ -= this.trackLength;

      const depth = e.worldZ - cameraZ;
      if (depth < -2000 || (e.worldZ < cameraZ && depth > -DRAW_DISTANCE)) {
        e.worldZ = cameraZ + DRAW_DISTANCE * (RESPAWN_DEPTH_MIN_RATIO + Math.random() * RESPAWN_DEPTH_RANGE_RATIO);
        e.laneX = (Math.random() - 0.5) * RESPAWN_LANE_RANGE;
        if (e.type === 'ai_rider') {
          const behavior = this.aiBehaviors.get(e);
          if (behavior) behavior.reset();
        }
      }

      if (e.type === 'ai_rider') {
        const behavior = this.aiBehaviors.get(e);
        if (behavior) {
          const dz = this.wrapDelta(cameraZ, e.worldZ);
          const inRange = Math.abs(dz) < AI_ATTACK_RANGE && Math.abs(e.laneX - playerX) < MELEE_WIDTH;
          behavior.update(dt, (ent) => this.getObstaclesAhead(ent, cameraZ, playerX), inRange);
        }
      }
    }

    for (const e of toRemove) {
      const idx = this.entities.indexOf(e);
      if (idx >= 0) this.entities.splice(idx, 1);
    }

    this.pickupSpawnTimer -= dt;
    if (this.pickupSpawnTimer <= 0 && this.weaponPickups.length < MAX_PICKUPS) {
      this.pickupSpawnTimer = PICKUP_SPAWN_MIN + Math.random() * (PICKUP_SPAWN_MAX - PICKUP_SPAWN_MIN);
      const side = Math.random() < 0.5 ? -1 : 1;
      this.weaponPickups.push({
        worldZ: cameraZ + PICKUP_DEPTH * (0.6 + Math.random() * 0.4),
        laneX: side * (0.8 + Math.random() * 0.3),
        weaponType: Math.random() < 0.5 ? 'club' : 'chain',
        flashTimer: 0,
      });
    }

    for (const p of this.weaponPickups) {
      p.flashTimer = (p.flashTimer + dt * 4) % 1;
    }

    this.weaponPickups = this.weaponPickups.filter(p => {
      const dz = this.wrapDelta(cameraZ, p.worldZ);
      return dz > -2000;
    });
  }

  checkPickupCollection(cameraZ: number, playerX: number): WeaponType | null {
    for (let i = this.weaponPickups.length - 1; i >= 0; i--) {
      const p = this.weaponPickups[i];
      const dz = this.wrapDelta(cameraZ, p.worldZ);
      if (Math.abs(dz) < PICKUP_HIT_DEPTH && Math.abs(p.laneX - playerX) < PICKUP_HIT_WIDTH) {
        const type = p.weaponType;
        this.weaponPickups.splice(i, 1);
        return type;
      }
    }
    return null;
  }

  checkAIAttacks(): boolean {
    let anyHit = false;
    for (const e of this.entities) {
      if (e.type !== 'ai_rider') continue;
      const behavior = this.aiBehaviors.get(e);
      if (behavior && behavior.consumePendingAttack()) {
        anyHit = true;
      }
    }
    return anyHit;
  }

  setPlayerSpeed(speed: number): void {
    this.playerCurrentSpeed = speed;
  }

  updatePoliceCount(heatLevel: number, cameraZ: number): void {
    const pc = this.levelConfig.police;
    const desired = heatLevel >= pc.heatThreshold ? Math.min(pc.maxCount, Math.floor(heatLevel - pc.heatThreshold) + 1) : 0;
    const current = this.entities.filter(e => e.type === 'police' && !e.knockedOut).length;

    if (current < desired) {
      const [base, perHeat] = pc.speedMultiplierRange;
      const police: Entity = {
        type: 'police',
        worldZ: cameraZ - POLICE_SPAWN_BEHIND,
        laneX: (Math.random() - 0.5) * 0.8,
        speed: 0,
        targetSpeed: this.playerCurrentSpeed * (base + perHeat * heatLevel),
        width: RIDER_WIDTH,
        height: RIDER_HEIGHT,
        color: POLICE_RIDER_COLOR,
        motoColor: POLICE_MOTO_COLOR,
        health: pc.maxHealth,
      };
      this.entities.push(police);
    }
  }

  updatePoliceSpeed(heatLevel: number): void {
    const [base, perHeat] = this.levelConfig.police.speedMultiplierRange;
    const targetSpeed = this.playerCurrentSpeed * (base + perHeat * heatLevel);
    for (const e of this.entities) {
      if (e.type === 'police' && !e.knockedOut) {
        e.targetSpeed = targetSpeed;
      }
    }
  }

  removePolice(entity: Entity): void {
    const idx = this.entities.indexOf(entity);
    if (idx >= 0) this.entities.splice(idx, 1);
  }

  hasActivePolice(): boolean {
    return this.entities.some(e => e.type === 'police' && !e.knockedOut);
  }

  setPoliceRespawn(shouldRespawn: boolean): void {
    this.policeShouldRespawn = shouldRespawn;
  }

  getTrackLength(): number {
    return this.trackLength;
  }

  getAIRiders(): Entity[] {
    return this.entities.filter(e => e.type === 'ai_rider');
  }

  getPolicePushForces(cameraZ: number, playerX: number, dt: number): number {
    let totalPush = 0;
    const pushStr = this.levelConfig.police.pushStrength;
    for (const e of this.entities) {
      if (e.type !== 'police' || e.knockedOut) continue;
      const dz = this.wrapDelta(cameraZ, e.worldZ);
      if (Math.abs(dz) < MELEE_DEPTH && Math.abs(e.laneX - playerX) < MELEE_WIDTH) {
        totalPush += Math.sign(playerX - e.laneX) * pushStr;
      }
    }
    return totalPush * dt;
  }

  isPoliceNear(cameraZ: number, playerX: number): boolean {
    for (const e of this.entities) {
      if (e.type !== 'police' || e.knockedOut) continue;
      const dz = this.wrapDelta(cameraZ, e.worldZ);
      if (Math.abs(dz) < ARREST_Z_RANGE && Math.abs(e.laneX - playerX) < MELEE_WIDTH) return true;
    }
    return false;
  }

  hitAIRider(entity: Entity): void {
    if (entity.type !== 'ai_rider') return;
    if (entity.knockedOut) return;
    const behavior = this.aiBehaviors.get(entity);
    if (behavior) behavior.onHit();
  }

  private respawnBehind(e: Entity, cameraZ: number): void {
    e.knockedOut = false;
    e.knockbackTimer = 0;
    e.health = e.type === 'police' ? this.levelConfig.police.maxHealth : (e.type === 'ai_rider' ? AI_MAX_HEALTH : undefined);
    e.laneX = (Math.random() - 0.5) * 1.2;
    e.speed = e.type === 'police' ? 0 : (e.type === 'ai_rider' ? (e.targetSpeed ?? AI_FALLBACK_SPEED) * AI_RESPAWN_SPEED_RATIO : TRAFFIC_RESPAWN_SPEED);
    e.worldZ = cameraZ - RESPAWN_BEHIND_DISTANCE;
    if (e.worldZ < 0) e.worldZ += this.trackLength;
    this.collisionCooldowns.delete(e);
    if (e.type === 'ai_rider') {
      const behavior = this.aiBehaviors.get(e);
      if (behavior) behavior.reset();
      const wp = this.levelConfig.aiRiders;
      if (Math.random() < wp.weaponChance && wp.weaponPool.length > 0) {
        e.weapon = wp.weaponPool[Math.floor(Math.random() * wp.weaponPool.length)];
      } else {
        e.weapon = undefined;
      }
    }
  }

  checkPlayerCollisions(cameraZ: number, playerX: number): CollisionResult[] {
    const results: CollisionResult[] = [];

    for (const e of this.entities) {
      if (this.collisionCooldowns.has(e)) continue;
      if (e.knockedOut) continue;

      const dz = this.wrapDelta(cameraZ, e.worldZ);

      if (Math.abs(dz) < HIT_DEPTH && Math.abs(e.laneX - playerX) < HIT_WIDTH) {
        this.collisionCooldowns.set(e, COLLISION_COOLDOWN);

        if (e.type === 'traffic') {
          results.push({ entity: e, type: 'traffic_crash' });
        } else if (e.type === 'ai_rider') {
          this.hitAIRider(e);
          results.push({ entity: e, type: 'ai_push' });
        } else if (e.type === 'police') {
          results.push({ entity: e, type: 'ai_push' });
        }
      }
    }

    return results;
  }

  findMeleeTarget(cameraZ: number, playerX: number, rangeMultiplier = 1.0): Entity | null {
    let nearest: Entity | null = null;
    let nearestDz = Infinity;
    const effectiveDepth = MELEE_DEPTH * rangeMultiplier;

    for (const e of this.entities) {
      if (e.type === 'traffic') continue;
      if (e.health !== undefined && e.health <= 0) continue;

      const dz = this.wrapDelta(cameraZ, e.worldZ);

      const absDz = Math.abs(dz);
      if (absDz < effectiveDepth && Math.abs(e.laneX - playerX) < MELEE_WIDTH) {
        if (absDz < nearestDz) {
          nearest = e;
          nearestDz = absDz;
        }
      }
    }

    return nearest;
  }

  private getObstaclesAhead(entity: Entity, cameraZ: number, playerX: number): { laneX: number }[] {
    const results: { laneX: number }[] = [];

    for (const other of this.entities) {
      if (other === entity) continue;
      const dz = this.wrapDelta(entity.worldZ, other.worldZ);
      if (dz > 0 && dz < OBSTACLE_Z_RANGE && Math.abs(other.laneX - entity.laneX) < OBSTACLE_X_RANGE) {
        results.push(other);
      }
    }

    const dzPlayer = this.wrapDelta(entity.worldZ, cameraZ);
    if (dzPlayer > 0 && dzPlayer < OBSTACLE_Z_RANGE && Math.abs(playerX - entity.laneX) < OBSTACLE_X_RANGE) {
      results.push({ laneX: playerX });
    }

    return results;
  }

  getEntityScreenCoords(
    entity: Entity,
    cameraZ: number,
    playerX: number,
    zMapper: ZMapper,
  ): { screenX: number; screenY: number; pw: number; ph: number } | null {
    const depth = entity.worldZ - cameraZ;
    if (depth <= 0 || depth > DRAW_DISTANCE) return null;

    const camHeight = zMapper.getCamHeight();
    const horizonY = zMapper.getHorizonY();
    const screenHeight = zMapper.getScreenHeight();
    const screenWidth = zMapper.getScreenWidth();

    const offsets = this.computeOffsets(cameraZ, entity.worldZ);
    const scale = 1 / depth;
    const halfRoadPx = scale * ROAD_HALF_WIDTH;
    const hillShift = offsets.hill * scale;

    const screenY = horizonY + camHeight * screenHeight / depth;
    const centerX = screenWidth / 2 + (offsets.curve - playerX) * halfRoadPx;
    const screenX = centerX + entity.laneX * halfRoadPx;

    const pw = Math.max(1, scale * entity.width);
    const ph = Math.max(1, scale * entity.height);

    return { screenX, screenY: screenY - ph + hillShift, pw, ph };
  }

  renderTargetIndicator(
    ctx: CanvasRenderingContext2D,
    zMapper: ZMapper,
    cameraZ: number,
    playerX: number,
    target: Entity,
  ): void {
    const coords = this.getEntityScreenCoords(target, cameraZ, playerX, zMapper);
    if (!coords) return;

    const drawX = Math.round(coords.screenX - coords.pw / 2);
    const drawY = Math.round(coords.screenY);
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.strokeRect(drawX - 2, drawY - 2, coords.pw + 4, coords.ph + 4);
  }

  render(
    ctx: CanvasRenderingContext2D,
    zMapper: ZMapper,
    cameraZ: number,
    playerX: number,
  ): void {
    const camHeight = zMapper.getCamHeight();
    const horizonY = zMapper.getHorizonY();
    const screenHeight = zMapper.getScreenHeight();
    const screenWidth = zMapper.getScreenWidth();

    const visible = this.entities
      .filter(e => e.worldZ > cameraZ && e.worldZ - cameraZ < DRAW_DISTANCE)
      .sort((a, b) => (b.worldZ - cameraZ) - (a.worldZ - cameraZ));

    for (const entity of visible) {
      const depth = entity.worldZ - cameraZ;
      const offsets = this.computeOffsets(cameraZ, entity.worldZ);
      const scale = 1 / depth;
      const halfRoadPx = scale * ROAD_HALF_WIDTH;
      const hillShift = offsets.hill * scale;

      const screenY = horizonY + camHeight * screenHeight / depth;
      const centerX = screenWidth / 2 + (offsets.curve - playerX) * halfRoadPx;
      const screenX = centerX + entity.laneX * halfRoadPx;

      const pw = Math.max(1, scale * entity.width);
      const ph = Math.max(1, scale * entity.height);
      const drawX = Math.round(screenX - pw / 2);
      const drawY = Math.round(screenY - ph + hillShift);

      if (drawY + ph < 0 || drawY > screenHeight) continue;

      if (ph < 4) {
        ctx.fillStyle = entity.color;
        ctx.fillRect(drawX, drawY, pw, ph);
      } else {
        const riderH = Math.round(ph * RIDER_HEIGHT_RATIO);
        const motoH = ph - riderH;
        ctx.fillStyle = entity.motoColor ?? entity.color;
        ctx.fillRect(drawX, drawY + riderH, pw, motoH);
        ctx.fillStyle = entity.color;
        ctx.fillRect(drawX, drawY, pw, riderH);
      }
    }
  }

  renderPickups(
    ctx: CanvasRenderingContext2D,
    zMapper: ZMapper,
    cameraZ: number,
    playerX: number,
  ): void {
    const camHeight = zMapper.getCamHeight();
    const horizonY = zMapper.getHorizonY();
    const screenHeight = zMapper.getScreenHeight();
    const screenWidth = zMapper.getScreenWidth();

    for (const pickup of this.weaponPickups) {
      const depth = pickup.worldZ - cameraZ;
      if (depth <= 0 || depth > DRAW_DISTANCE) continue;

      const offsets = this.computeOffsets(cameraZ, pickup.worldZ);
      const scale = 1 / depth;
      const halfRoadPx = scale * ROAD_HALF_WIDTH;
      const hillShift = offsets.hill * scale;

      const screenY = horizonY + camHeight * screenHeight / depth;
      const centerX = screenWidth / 2 + (offsets.curve - playerX) * halfRoadPx;
      const screenX = centerX + pickup.laneX * halfRoadPx;

      const pw = Math.max(4, scale * 600);
      const ph = Math.max(3, scale * 400);
      const drawX = Math.round(screenX - pw / 2);
      const drawY = Math.round(screenY - ph + hillShift);

      if (drawY + ph < 0 || drawY > screenHeight) continue;

      const flash = Math.sin(pickup.flashTimer * Math.PI * 2);
      const alpha = 0.4 + 0.6 * Math.max(0, flash);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = WEAPON_CONFIGS[pickup.weaponType].color;
      ctx.fillRect(drawX, drawY, pw, ph);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, pw * 0.05);
      ctx.strokeRect(drawX, drawY, pw, ph);
      ctx.restore();
    }
  }

  private computeOffsets(fromZ: number, toZ: number): { curve: number; hill: number } {
    let curve = 0;
    let hill = 0;
    const steps = Math.min(Math.ceil((toZ - fromZ) / SEGMENT_LENGTH), DRAW_DISTANCE / SEGMENT_LENGTH);
    for (let i = 0; i < steps; i++) {
      const z = fromZ + i * SEGMENT_LENGTH;
      const seg = getSegmentAtZ(this.trackData, z);
      curve += seg.curve * CURVE_SEGMENT_FACTOR;
      hill += seg.hill * HILL_SEGMENT_FACTOR;
    }
    return { curve, hill };
  }

  private wrapDelta(fromZ: number, toZ: number): number {
    let dz = toZ - fromZ;
    if (dz < -this.trackLength / 2) dz += this.trackLength;
    if (dz > this.trackLength / 2) dz -= this.trackLength;
    return dz;
  }
}
