import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StorageManager } from '../src/StorageManager';

describe('StorageManager', () => {
  beforeEach(() => {
    localStorage.clear(); // aislar cada test de estado dejado por otros
  });

  describe('save() / load(): round-trip básico', () => {
    it('guardar y cargar un valor simple produce un resultado equivalente', () => {
      const storage = new StorageManager('game1');
      storage.save('score', 100);

      expect(storage.load('score')).toBe(100);
    });

    it('guardar y cargar un objeto complejo (anidado, con arrays) produce un resultado equivalente', () => {
      const storage = new StorageManager('game1');
      const complexData = {
        playerName: 'Furina',
        level: 5,
        inventory: ['sword', 'shield', { id: 'potion', quantity: 3 }],
        stats: { hp: 100, mp: 50, buffs: [{ name: 'strength', turns: 2 }] },
      };

      storage.save('playerData', complexData);
      const loaded = storage.load('playerData');

      expect(loaded).toEqual(complexData);
    });

    it('save() retorna true cuando el guardado fue exitoso', () => {
      const storage = new StorageManager('game1');
      expect(storage.save('key', 'value')).toBe(true);
    });
  });

  describe('load(): casos borde', () => {
    it('load() sobre una clave que no existe retorna undefined, no lanza ni retorna null', () => {
      const storage = new StorageManager('game1');
      expect(storage.load('no-existe')).toBeUndefined();
    });

    it('load() sobre JSON corrupto lo trata igual que "no existe": retorna undefined sin lanzar', () => {
      const storage = new StorageManager('game1');
      // Simula que algo externo escribió directamente en localStorage
      // sin pasar por StorageManager, dejando JSON inválido.
      localStorage.setItem('game1:corrupted', '{ esto no es JSON válido {{{');

      expect(() => storage.load('corrupted')).not.toThrow();
      expect(storage.load('corrupted')).toBeUndefined();
    });
  });

  describe('remove() y has()', () => {
    it('has() refleja true tras guardar y false tras remove()', () => {
      const storage = new StorageManager('game1');
      expect(storage.has('key')).toBe(false);

      storage.save('key', 'value');
      expect(storage.has('key')).toBe(true);

      storage.remove('key');
      expect(storage.has('key')).toBe(false);
    });

    it('remove() sobre una clave inexistente no lanza (no-op seguro)', () => {
      const storage = new StorageManager('game1');
      expect(() => storage.remove('nunca-existio')).not.toThrow();
    });

    it('load() tras remove() retorna undefined', () => {
      const storage = new StorageManager('game1');
      storage.save('key', 'value');
      storage.remove('key');

      expect(storage.load('key')).toBeUndefined();
    });
  });

  describe('namespacing: aislamiento entre instancias', () => {
    it('dos instancias con distinto namespace no interfieren aunque usen la misma clave', () => {
      const gameA = new StorageManager('game-a');
      const gameB = new StorageManager('game-b');

      gameA.save('score', 100);
      gameB.save('score', 999);

      expect(gameA.load('score')).toBe(100);
      expect(gameB.load('score')).toBe(999);
    });

    it('remove() en una instancia no afecta la misma clave lógica en otro namespace', () => {
      const gameA = new StorageManager('game-a');
      const gameB = new StorageManager('game-b');

      gameA.save('score', 100);
      gameB.save('score', 999);

      gameA.remove('score');

      expect(gameA.load('score')).toBeUndefined();
      expect(gameB.load('score')).toBe(999); // intacto
    });

    it('has() en una instancia no ve las claves de otro namespace', () => {
      const gameA = new StorageManager('game-a');
      const gameB = new StorageManager('game-b');

      gameA.save('uniqueKey', 'value');

      expect(gameA.has('uniqueKey')).toBe(true);
      expect(gameB.has('uniqueKey')).toBe(false);
    });

    it('las claves se almacenan realmente con el prefijo namespace:key en localStorage', () => {
      const storage = new StorageManager('mygame');
      storage.save('level', 3);

      expect(localStorage.getItem('mygame:level')).not.toBeNull();
      expect(localStorage.getItem('level')).toBeNull(); // sin el prefijo, no debe existir
    });
  });

  describe('clear(): borra solo el namespace propio', () => {
    it('clear() borra todas las claves del namespace de esta instancia', () => {
      const storage = new StorageManager('game1');
      storage.save('a', 1);
      storage.save('b', 2);
      storage.save('c', 3);

      storage.clear();

      expect(storage.has('a')).toBe(false);
      expect(storage.has('b')).toBe(false);
      expect(storage.has('c')).toBe(false);
    });

    it('clear() NO borra claves de otro namespace presentes en el mismo localStorage', () => {
      const gameA = new StorageManager('game-a');
      const gameB = new StorageManager('game-b');

      gameA.save('score', 100);
      gameB.save('score', 999);
      gameB.save('level', 5);

      gameA.clear();

      expect(gameA.has('score')).toBe(false);
      expect(gameB.has('score')).toBe(true); // intacto
      expect(gameB.has('level')).toBe(true); // intacto
    });

    it('clear() no lanza si el namespace no tiene ninguna clave guardada', () => {
      const storage = new StorageManager('vacio');
      expect(() => storage.clear()).not.toThrow();
    });

    it('clear() no afecta claves de localStorage que no pertenecen a ningún StorageManager (uso directo externo)', () => {
      localStorage.setItem('claveExterna', 'algo que no pasó por StorageManager');
      const storage = new StorageManager('game1');
      storage.save('propia', 'valor');

      storage.clear();

      expect(localStorage.getItem('claveExterna')).toBe('algo que no pasó por StorageManager');
    });
  });

  describe('manejo de QuotaExceededError', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('save() retorna false (no lanza) cuando localStorage.setItem lanza QuotaExceededError', () => {
      const storage = new StorageManager('game1');

      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw quotaError;
      });

      let result: boolean | undefined;
      expect(() => {
        result = storage.save('key', 'value');
      }).not.toThrow();

      expect(result).toBe(false);
    });

    it('un save() fallido por cuota no deja datos parciales o corruptos accesibles vía load()', () => {
      const storage = new StorageManager('game1');
      storage.save('key', 'valor-original'); // esto sí sale bien, antes de simular el fallo

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      });

      storage.save('key', 'valor-nuevo-que-falla');

      vi.restoreAllMocks(); // liberamos el mock para poder leer de verdad

      expect(storage.load('key')).toBe('valor-original'); // el valor previo se mantuvo intacto
    });
  });
});
