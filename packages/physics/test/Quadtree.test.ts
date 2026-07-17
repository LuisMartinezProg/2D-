import { describe, it, expect } from 'vitest';
import { Quadtree } from '../src/Quadtree';

describe('Quadtree', () => {
  const worldBounds = { x: 0, y: 0, width: 1000, height: 1000 };

  describe('inserción y consulta básica', () => {
    it('una consulta por región retorna exactamente las entidades dentro de esa región', () => {
      const qt = new Quadtree(worldBounds, 5, 8);

      qt.insert(1, { x: 10, y: 10, width: 20, height: 20 });   // dentro de la región de consulta
      qt.insert(2, { x: 500, y: 500, width: 20, height: 20 }); // lejos, no debería aparecer
      qt.insert(3, { x: 15, y: 15, width: 20, height: 20 });   // también dentro

      const results = qt.query({ x: 0, y: 0, width: 100, height: 100 });

      expect(results).toContain(1);
      expect(results).toContain(3);
      expect(results).not.toContain(2);
    });

    it('una entidad que no interseca ninguna región de consulta no aparece en ningún resultado', () => {
      const qt = new Quadtree(worldBounds, 5, 8);
      qt.insert(1, { x: 900, y: 900, width: 10, height: 10 });

      const results = qt.query({ x: 0, y: 0, width: 50, height: 50 });

      expect(results).not.toContain(1);
    });

    it('consulta con una región vacía de entidades devuelve array vacío', () => {
      const qt = new Quadtree(worldBounds, 5, 8);
      qt.insert(1, { x: 10, y: 10, width: 10, height: 10 });

      const results = qt.query({ x: 800, y: 800, width: 50, height: 50 });

      expect(results).toEqual([]);
    });
  });

  describe('subdivisión respeta maxEntitiesPerNode', () => {
    it('insertar más entidades que maxEntitiesPerNode en la misma zona dispara subdivisión sin perder entidades', () => {
      const qt = new Quadtree(worldBounds, 5, 3); // maxEntitiesPerNode bajo, para forzar subdivisión fácil

      // 10 entidades dispersas por todo el mapa, bien separadas entre sí,
      // para que terminen en distintos cuadrantes tras la subdivisión.
      for (let i = 0; i < 10; i++) {
        qt.insert(i, { x: i * 90, y: i * 90, width: 10, height: 10 });
      }

      // Consultar TODO el mapa debe devolver las 10, sin importar
      // cuántas veces se haya subdividido internamente.
      const results = qt.query(worldBounds);

      expect(new Set(results)).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    });
  });

  describe('respeta quadtreeMaxDepth', () => {
    it('no se subdivide más allá de maxDepth, incluso con muchísimas entidades en la misma zona', () => {
      const qt = new Quadtree(worldBounds, 2, 2); // profundidad muy baja a propósito

      // Todas en la MISMA zona pequeña, muy por encima de maxEntitiesPerNode.
      for (let i = 0; i < 50; i++) {
        qt.insert(i, { x: 10, y: 10, width: 1, height: 1 });
      }

      // No debe lanzar (recursión infinita sería el síntoma de no
      // respetar maxDepth) y debe seguir devolviendo todas al consultar.
      expect(() => qt.query(worldBounds)).not.toThrow();
      const results = qt.query(worldBounds);
      expect(results).toHaveLength(50);
    });
  });

  describe('AABB que cruza el límite entre cuadrantes', () => {
    it('una entidad grande que abarca dos cuadrantes aparece en consultas de ambos lados', () => {
      const qt = new Quadtree(worldBounds, 5, 1); // fuerza subdivisión inmediata

      // Rect que cruza el centro exacto del mapa (500,500), abarcando
      // parte de más de un cuadrante tras la subdivisión.
      qt.insert(1, { x: 480, y: 480, width: 40, height: 40 });

      const leftResults = qt.query({ x: 400, y: 400, width: 100, height: 100 });
      const rightResults = qt.query({ x: 500, y: 500, width: 100, height: 100 });

      expect(leftResults).toContain(1);
      expect(rightResults).toContain(1);
    });
  });

  describe('caso borde: quadtree vacío', () => {
    it('consultar un quadtree sin ninguna inserción devuelve array vacío, no lanza', () => {
      const qt = new Quadtree(worldBounds, 5, 8);
      expect(() => qt.query(worldBounds)).not.toThrow();
      expect(qt.query(worldBounds)).toEqual([]);
    });
  });
});
