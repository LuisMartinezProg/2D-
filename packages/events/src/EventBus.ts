export type EventPayload = Record<string, unknown>;
export type EventCallback<T extends EventPayload = EventPayload> = (payload: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<EventCallback<any>>>();
  private onceListeners = new Map<string, Set<EventCallback<any>>>();

  on<T extends EventPayload>(eventName: string, callback: EventCallback<T>): void {
    this.getOrCreateSet(this.listeners, eventName).add(callback);
  }

  off<T extends EventPayload>(eventName: string, callback: EventCallback<T>): void {
    this.listeners.get(eventName)?.delete(callback);
    this.onceListeners.get(eventName)?.delete(callback);
  }

  once<T extends EventPayload>(eventName: string, callback: EventCallback<T>): void {
    this.getOrCreateSet(this.onceListeners, eventName).add(callback);
  }

  emit<T extends EventPayload>(eventName: string, payload: T): void {
    const regular = this.listeners.get(eventName);
    if (regular) {
      for (const callback of [...regular]) {
        this.safeInvoke(callback, payload, eventName);
      }
    }

    const once = this.onceListeners.get(eventName);
    if (once) {
      // Copia + limpieza previa: si un callback once vuelve a suscribirse
      // a sí mismo durante su propia invocación, no debe re-dispararse en este emit.
      const toRun = [...once];
      once.clear();
      for (const callback of toRun) {
        this.safeInvoke(callback, payload, eventName);
      }
    }
  }

  clear(eventName?: string): void {
    if (eventName === undefined) {
      this.listeners.clear();
      this.onceListeners.clear();
      return;
    }
    this.listeners.delete(eventName);
    this.onceListeners.delete(eventName);
  }

  private getOrCreateSet(map: Map<string, Set<EventCallback<any>>>, eventName: string): Set<EventCallback<any>> {
    let set = map.get(eventName);
    if (!set) {
      set = new Set();
      map.set(eventName, set);
    }
    return set;
  }

  /** Un callback que lanza no debe interrumpir a los demás suscritos al mismo evento. */
  private safeInvoke<T extends EventPayload>(callback: EventCallback<T>, payload: T, eventName: string): void {
    try {
      callback(payload);
    } catch (error) {
      console.error(`[EventBus] Error en callback suscrito a "${eventName}":`, error);
    }
  }
}
