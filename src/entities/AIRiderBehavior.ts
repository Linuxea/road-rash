import type { Entity } from './types';

const LANE_CENTER_PULL = 0.3;
const LANE_CHANGE_SPEED = 1.5;
const ATTACK_SPEED_FACTOR = 0.6;
const ATTACK_RECOVERY_TIME = 1.5;
const SPEED_ADJUST_RATE = 300;
const ATTACK_WINDUP = 0.3;
const AI_ATTACK_HIT_CHANCE = 0.50;

interface Obstacle {
  laneX: number;
}

interface PlayerInfo {
  inMeleeRange: boolean;
}

interface AIState {
  enter(ctx: AIRiderBehavior): void;
  update(dt: number, ctx: AIRiderBehavior, obstacles: Obstacle[], player: PlayerInfo): void;
}

class NormalState implements AIState {
  enter(ctx: AIRiderBehavior): void {
    ctx.entity.aiState = 'normal';
  }

  update(dt: number, ctx: AIRiderBehavior, obstacles: Obstacle[], player: PlayerInfo): void {
    const { entity } = ctx;
    const target = entity.targetSpeed ?? 4000;

    if (entity.speed < target) {
      entity.speed = Math.min(entity.speed + SPEED_ADJUST_RATE * dt, target);
    } else if (entity.speed > target) {
      entity.speed = Math.max(entity.speed - SPEED_ADJUST_RATE * dt, target);
    }

    entity.laneX *= (1 - LANE_CENTER_PULL * dt);

    if (obstacles.length > 0) {
      const nearest = obstacles.reduce((best, o) =>
        Math.abs(o.laneX - entity.laneX) < Math.abs(best.laneX - entity.laneX) ? o : best);
      ctx.targetLaneX = nearest.laneX > entity.laneX
        ? Math.max(-0.8, entity.laneX - 0.4)
        : Math.min(0.8, entity.laneX + 0.4);
      ctx.setState(new AvoidState());
      return;
    }

    if (player.inMeleeRange && Math.random() < 0.3 * dt) {
      ctx.setState(new AttackingState());
      return;
    }

    entity.laneX = Math.max(-0.8, Math.min(0.8, entity.laneX));
    entity.aiState = 'normal';
  }
}

class AvoidState implements AIState {
  enter(ctx: AIRiderBehavior): void {
    ctx.entity.aiState = 'avoid';
  }

  update(dt: number, ctx: AIRiderBehavior, _obstacles: Obstacle[], _player: PlayerInfo): void {
    const { entity } = ctx;
    const target = entity.targetSpeed ?? 4000;

    if (entity.speed < target) {
      entity.speed = Math.min(entity.speed + SPEED_ADJUST_RATE * dt, target);
    }

    const diff = ctx.targetLaneX - entity.laneX;
    const step = LANE_CHANGE_SPEED * dt;
    if (Math.abs(diff) <= step) {
      entity.laneX = ctx.targetLaneX;
      ctx.setState(new NormalState());
    } else {
      entity.laneX += Math.sign(diff) * step;
    }

    entity.laneX = Math.max(-0.8, Math.min(0.8, entity.laneX));
    entity.aiState = 'avoid';
  }
}

class AttackedState implements AIState {
  enter(ctx: AIRiderBehavior): void {
    ctx.entity.aiState = 'attacked';
    ctx.entity.speed *= ATTACK_SPEED_FACTOR;
    ctx.recoveryTimer = ATTACK_RECOVERY_TIME;
  }

  update(dt: number, ctx: AIRiderBehavior, _obstacles: Obstacle[], _player: PlayerInfo): void {
    ctx.recoveryTimer -= dt;
    ctx.entity.laneX += (Math.random() - 0.5) * 0.8 * dt;
    ctx.entity.laneX = Math.max(-0.8, Math.min(0.8, ctx.entity.laneX));

    if (ctx.recoveryTimer <= 0) {
      ctx.setState(new NormalState());
    } else {
      ctx.entity.aiState = 'attacked';
    }
  }
}

class AttackingState implements AIState {
  enter(ctx: AIRiderBehavior): void {
    ctx.entity.aiState = 'attacking';
    ctx.windupTimer = ATTACK_WINDUP;
  }

  update(dt: number, ctx: AIRiderBehavior, _obstacles: Obstacle[], player: PlayerInfo): void {
    ctx.windupTimer -= dt;

    if (ctx.windupTimer <= 0) {
      ctx.pendingAttack = player.inMeleeRange && Math.random() < AI_ATTACK_HIT_CHANCE;
      ctx.setState(new NormalState());
    } else {
      ctx.entity.aiState = 'attacking';
    }
  }
}

export class AIRiderBehavior {
  entity: Entity;
  private state: AIState;
  targetLaneX = 0;
  recoveryTimer = 0;
  windupTimer = 0;
  pendingAttack = false;

  constructor(entity: Entity) {
    this.entity = entity;
    this.state = new NormalState();
    this.state.enter(this);
  }

  update(dt: number, getObstacles: (entity: Entity) => Obstacle[], playerInRange: boolean): void {
    this.pendingAttack = false;
    const obstacles = getObstacles(this.entity);
    this.state.update(dt, this, obstacles, { inMeleeRange: playerInRange });
  }

  consumePendingAttack(): boolean {
    if (this.pendingAttack) {
      this.pendingAttack = false;
      return true;
    }
    return false;
  }

  onHit(): void {
    this.setState(new AttackedState());
  }

  reset(): void {
    this.setState(new NormalState());
  }

  setState(newState: AIState): void {
    this.state = newState;
    this.state.enter(this);
  }
}
