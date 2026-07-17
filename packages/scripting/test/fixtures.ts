import { ScriptComponent, type GameContext } from '../src/types';
import type { EntityId } from '@mochigo/ecs';

/** Script con TODOS los hooks, cada uno registrando su propia llamada
 * para poder verificar cuántas veces y con qué argumentos se invocó. */
export class FullLifecycleScript extends ScriptComponent {
  static readonly componentName = 'FullLifecycleScript';
  static readonly schema = {};

  startCalls: GameContext[] = [];
  updateCalls: GameContext[] = [];
  collisionEnterCalls: Array<{ ctx: GameContext; other: EntityId }> = [];
  collisionExitCalls: Array<{ ctx: GameContext; other: EntityId }> = [];
  destroyCalls: GameContext[] = [];

  onStart(ctx: GameContext): void {
    this.startCalls.push(ctx);
  }
  onUpdate(ctx: GameContext): void {
    this.updateCalls.push(ctx);
  }
  onCollisionEnter(ctx: GameContext, other: EntityId): void {
    this.collisionEnterCalls.push({ ctx, other });
  }
  onCollisionExit(ctx: GameContext, other: EntityId): void {
    this.collisionExitCalls.push({ ctx, other });
  }
  onDestroy(ctx: GameContext): void {
    this.destroyCalls.push(ctx);
  }
}

/** Script minimalista: SOLO onUpdate, sin ningún otro hook. Prueba que
 * ScriptingSystem no explota cuando faltan hooks opcionales. */
export class UpdateOnlyScript extends ScriptComponent {
  static readonly componentName = 'UpdateOnlyScript';
  static readonly schema = {};

  updateCalls = 0;

  onUpdate(): void {
    this.updateCalls++;
  }
}

/** Script que lanza un error DENTRO de un hook, para probar el
 * aislamiento de fallos (un script roto no debe frenar a los demás). */
export class ThrowingScript extends ScriptComponent {
  static readonly componentName = 'ThrowingScript';
  static readonly schema = {};

  onUpdate(): void {
    throw new Error('fallo intencional para probar aislamiento');
  }
}

/** Script sin NINGÚN hook implementado, solo para confirmar que
 * registrar y actualizar una entidad "vacía" no rompe nada. */
export class EmptyScript extends ScriptComponent {
  static readonly componentName = 'EmptyScript';
  static readonly schema = {};
}
