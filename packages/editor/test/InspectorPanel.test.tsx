import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { World, Transform } from '@mochigo/ecs';
import type { ComponentClass } from '@mochigo/ecs';
import { Vector2 } from '@mochigo/math';
import { InspectorPanel } from '../src/panels/InspectorPanel';
import { FullSchemaTestScript } from './fixtures';

afterEach(() => cleanup());

describe('InspectorPanel', () => {
  it('muestra un mensaje cuando no hay entidad seleccionada', () => {
    const world = new World();
    render(<InspectorPanel world={world} selectedEntity={null} knownComponentClasses={new Map()} scriptSchemas={new Map()} onFieldChanged={() => {}} />);
    expect(screen.getByText(/ninguna entidad seleccionada/i)).toBeTruthy();
  });

  it('renderiza los campos de un componente presente, con sus valores actuales', () => {
    const world = new World();
    const entity = world.createEntity();
    world.addComponent(entity, Transform, new Transform(new Vector2(5, 10)));
    const registry = new Map<string, ComponentClass<any>>([[Transform.componentName, Transform]]);

    render(<InspectorPanel world={world} selectedEntity={entity} knownComponentClasses={registry} scriptSchemas={new Map()} onFieldChanged={() => {}} />);

    expect(screen.getByText('Transform')).toBeTruthy();
    expect((screen.getByLabelText('position X') as HTMLInputElement).value).toBe('5');
    expect((screen.getByLabelText('position Y') as HTMLInputElement).value).toBe('10');
  });

  it('editar un campo muta el componente REAL en el World, no una copia', () => {
    const world = new World();
    const entity = world.createEntity();
    const transform = new Transform(new Vector2(0, 0));
    world.addComponent(entity, Transform, transform);
    const registry = new Map<string, ComponentClass<any>>([[Transform.componentName, Transform]]);
    const onFieldChanged = vi.fn();

    render(<InspectorPanel world={world} selectedEntity={entity} knownComponentClasses={registry} scriptSchemas={new Map()} onFieldChanged={onFieldChanged} />);

    fireEvent.change(screen.getByLabelText('rotation'), { target: { value: '1.5' } });

    expect(world.getComponent(entity, Transform)!.rotation).toBeCloseTo(1.5, 5);
    expect(transform.rotation).toBeCloseTo(1.5, 5); // misma instancia
    expect(onFieldChanged).toHaveBeenCalledTimes(1);
  });

  it('editar X e Y de un vector2 actualiza ambos ejes de forma independiente', () => {
    const world = new World();
    const entity = world.createEntity();
    const transform = new Transform(new Vector2(0, 0));
    world.addComponent(entity, Transform, transform);
    const registry = new Map<string, ComponentClass<any>>([[Transform.componentName, Transform]]);

    render(<InspectorPanel world={world} selectedEntity={entity} knownComponentClasses={registry} scriptSchemas={new Map()} onFieldChanged={() => {}} />);

    fireEvent.change(screen.getByLabelText('position X'), { target: { value: '42' } });
    fireEvent.change(screen.getByLabelText('position Y'), { target: { value: '7' } });

    expect(transform.position.x).toBe(42);
    expect(transform.position.y).toBe(7);
  });

  it('genera el tipo de campo correcto para cada uno de los 6 SchemaFieldType', () => {
    const world = new World();
    const entity = world.createEntity();
    world.addComponent(entity, FullSchemaTestScript, new FullSchemaTestScript());
    const registry = new Map<string, ComponentClass<any>>([[FullSchemaTestScript.componentName, FullSchemaTestScript as any]]);
    const scriptSchemas = new Map([[FullSchemaTestScript.componentName, FullSchemaTestScript.schema]]);

    render(<InspectorPanel world={world} selectedEntity={entity} knownComponentClasses={registry} scriptSchemas={scriptSchemas} onFieldChanged={() => {}} />);

    expect((screen.getByLabelText('speed') as HTMLInputElement).type).toBe('number');
    expect((screen.getByLabelText('speed') as HTMLInputElement).min).toBe('0');
    expect((screen.getByLabelText('speed') as HTMLInputElement).max).toBe('20');
    expect((screen.getByLabelText('label') as HTMLInputElement).type).toBe('text');
    expect((screen.getByLabelText('enabled') as HTMLInputElement).type).toBe('checkbox');
    expect((screen.getByLabelText('offset X') as HTMLInputElement).type).toBe('number');
    expect((screen.getByLabelText('offset Y') as HTMLInputElement).type).toBe('number');
    expect((screen.getByLabelText('tint') as HTMLInputElement).type).toBe('color');
    expect((screen.getByLabelText('target') as HTMLInputElement).type).toBe('number'); // decisión propia: entity = input numérico
  });

  it('una entidad sin componentes con schema muestra "sin componentes editables"', () => {
    const world = new World();
    const entity = world.createEntity();
    render(<InspectorPanel world={world} selectedEntity={entity} knownComponentClasses={new Map()} scriptSchemas={new Map()} onFieldChanged={() => {}} />);
    expect(screen.getByText(/no tiene componentes editables/i)).toBeTruthy();
  });
});
