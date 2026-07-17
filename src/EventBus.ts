import type { EventPayload, EventCallback } from './types';

/**
 * Entrada interna: envuelve cada callback registrado para poder marcar
 * los de `once()` sin tener que buscar en un segundo Set/Map paralelo.
 */
interface Listener {
  callback: EventCallback<any>;
  once: boolean;
}

export class EventBus {
  private listeners = new Map<string, Listener[]>();

  on<T extends EventPayload>(eventName: string, callback: EventCallback<T>): void {
    this.getOrCreateList(eventName).push({ callback, once: false });
  }

  once<T extends EventPayload>(eventName: string, callback: EventCallback<T>): void {
    this.getOrCreateList(eventName).push({ callback, once: true });
  }

  /** No-op seguro si el callback no estaba suscrito (mismo criterio que removeComponent en ECS). */
  off<T extends EventPayload>(eventName: string, callback: EventCallback<T>): void {
    const list = this.listeners.get(eventName);
    if (!list) return;
    const index = list.findIndex((entry) => entry.callback === callback);
    if (index !== -1) list.splice(index, 1);
  }

  /**
   * Síncrono (sección 4 del spec): todos los callbacks corren inmediatamente,
   * en el mismo tick, en orden de suscripción.
   *
   * Se itera sobre una COPIA del array (slice) porque `once` modifica la lista
   * original mientras se está iterando — sin la copia, splice() dentro del
   * loop desalinearía los índices y podría saltarse el siguiente callback.
   *
   * Un callback que lanza excepción se captura y loguea, sin interrumpir
   * a los demás (checklist sección 5).
   */
  emit<T extends EventPayload>(eventName: string, payload: T): void {
    const list = this.listeners.get(eventName);
    if (!list || list.length === 0) return;

    const onceEntriesToRemove: Listener[] = [];

    for (const entry of list.slice()) {
      try {
        entry.callback(payload);
      } catch (error) {
        console.error(`[EventBus] Error en callback suscrito a "${eventName}":`, error);
      }
      if (entry.once) onceEntriesToRemove.push(entry);
    }

    if (onceEntriesToRemove.length > 0) {
      const remaining = list.filter((entry) => !onceEntriesToRemove.includes(entry));
      this.listeners.set(eventName, remaining);
    }
  }

  /** Sin argumento: limpia TODO. Con nombre: limpia solo ese evento. */
  clear(eventName?: string): void {
    if (eventName === undefined) {
      this.listeners.clear();
    } else {
      this.listeners.delete(eventName);
    }
  }

  private getOrCreateList(eventName: string): Listener[] {
    let list = this.listeners.get(eventName);
    if (!list) {
      list = [];
      this.listeners.set(eventName, list);
    }
    return list;
  }
}
