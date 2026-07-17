export class StorageManager {
  constructor(private readonly namespace: string) {}

  /**
   * Retorna true si el guardado fue exitoso, false si falló por cuota
   * excedida (QuotaExceededError) u otro error de localStorage. No se
   * agrega un evento para esto (a pesar de que la ficha lo deja como
   * opción) porque este módulo se define explícitamente como "sin
   * dependencias de otros paquetes del motor" - depender de
   * @mochigo/events solo para esta señal rompería esa decisión de
   * aislamiento total. Un valor de retorno logra lo mismo sin ensuciar
   * la independencia del módulo.
   */
  save<T>(key: string, data: T): boolean {
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(this.namespacedKey(key), serialized);
      return true;
    } catch (error) {
      // QuotaExceededError (nombre varía sutilmente entre navegadores,
      // por eso no comparamos error.name contra un string exacto) u
      // otro fallo de localStorage (ej. modo privado de Safari, que
      // deshabilita localStorage por completo) - en ambos casos, el
      // contrato es el mismo: no lanzar, informar false.
      console.warn(`[StorageManager] No se pudo guardar la clave "${key}":`, error);
      return false;
    }
  }

  /**
   * Retorna undefined si la clave no existe O si el JSON almacenado
   * está corrupto (por ejemplo, algo externo modificó localStorage
   * directamente sin pasar por esta clase). Se trata ambos casos igual,
   * tal como sugiere la propia ficha - "no existe" y "no se puede leer"
   * son indistinguibles desde la perspectiva de quien llama a load(),
   * y ambos deben degradar con seguridad, nunca lanzar.
   */
  load<T>(key: string): T | undefined {
    const raw = localStorage.getItem(this.namespacedKey(key));
    if (raw === null) return undefined;

    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      console.warn(`[StorageManager] Datos corruptos para la clave "${key}", tratando como inexistente:`, error);
      return undefined;
    }
  }

  remove(key: string): void {
    localStorage.removeItem(this.namespacedKey(key));
  }

  /** Borra únicamente las claves bajo este namespace, sin tocar otras
   * claves de localStorage que pertenezcan a otro namespace u otro uso
   * del navegador. */
  clear(): void {
    const prefix = `${this.namespace}:`;
    const keysToRemove: string[] = [];

    // Dos pasadas: primero recolectar, después borrar. Borrar mientras
    // se itera localStorage directamente puede saltear entradas, porque
    // el índice de localStorage se recalcula en vivo a medida que se
    // eliminan elementos (mismo motivo por el que el EventBus real
    // itera una copia antes de mutar la lista original).
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (fullKey !== null && fullKey.startsWith(prefix)) {
        keysToRemove.push(fullKey);
      }
    }

    for (const fullKey of keysToRemove) {
      localStorage.removeItem(fullKey);
    }
  }

  has(key: string): boolean {
    return localStorage.getItem(this.namespacedKey(key)) !== null;
  }

  private namespacedKey(key: string): string {
    return `${this.namespace}:${key}`;
  }
}
