import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { World, Transform } from '@mochigo/ecs';
import type { ComponentClass } from '@mochigo/ecs';
import { Vector2 } from '@mochigo/math';
import { Sprite } from '@mochigo/renderer';
import { EventBus } from '@mochigo/events';
import { AssetManager } from '@mochigo/assets';
import { SceneManager } from '@mochigo/scenes';
import { EditorState } from '../src/EditorState';
import { EditorApp } from '../src/EditorApp';

describe('EditorApp: selección compartida entre Hierarchy, Inspector y Scene View', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1); // no ejecuta el callback: evita loops en el test
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('seleccionar una entidad en la Hierarchy la selecciona también en el Inspector y en el Scene View', async () => {
    const eventBus = new EventBus();
    const world = new World();
    const assetManager = new AssetManager(eventBus);
    const sceneManager = new SceneManager(world, assetManager, eventBus);

    const entityA = world.createEntity();
    world.addComponent(entityA, Transform, new Transform(new Vector2(1, 1)));
    world.addComponent(entityA, Sprite, new Sprite('texA'));
    const entityB = world.createEntity();
    world.addComponent(entityB, Transform, new Transform(new Vector2(2, 2)));
    world.addComponent(entityB, Sprite, new Sprite('texB'));

    const editorState = new EditorState(world, eventBus, sceneManager);
    editorState.notifyEntityCreated(entityA);
    editorState.notifyEntityCreated(entityB);

    const componentRegistry = new Map<string, ComponentClass<any>>([
      [Transform.componentName, Transform], [Sprite.componentName, Sprite],
    ]);
    const fakeRenderer = { render: vi.fn() } as any;

    const { container } = render(
      <EditorApp world={world} eventBus={eventBus} renderer={fakeRenderer} sceneManager={sceneManager}
        assetManager={assetManager} editorState={editorState} componentRegistry={componentRegistry} scriptSchemas={new Map()} />
    );

    fireEvent.click(screen.getByText(`Entity #${entityB}`));

    expect(await screen.findByText(`Inspector — Entity #${entityB}`)).toBeTruthy();
    expect(container.querySelector('[data-selected-entity]')?.getAttribute('data-selected-entity')).toBe(String(entityB));
  });

  it('cambiar de selección dos veces mantiene los tres paneles sincronizados con la última entidad elegida', async () => {
    const eventBus = new EventBus();
    const world = new World();
    const assetManager = new AssetManager(eventBus);
    const sceneManager = new SceneManager(world, assetManager, eventBus);
    const entityA = world.createEntity();
    world.addComponent(entityA, Transform, new Transform());
    const entityB = world.createEntity();
    world.addComponent(entityB, Transform, new Transform());

    const editorState = new EditorState(world, eventBus, sceneManager);
    editorState.notifyEntityCreated(entityA);
    editorState.notifyEntityCreated(entityB);

    const componentRegistry = new Map<string, ComponentClass<any>>([[Transform.componentName, Transform]]);
    const fakeRenderer = { render: vi.fn() } as any;

    const { container } = render(
      <EditorApp world={world} eventBus={eventBus} renderer={fakeRenderer} sceneManager={sceneManager}
        assetManager={assetManager} editorState={editorState} componentRegistry={componentRegistry} scriptSchemas={new Map()} />
    );

    fireEvent.click(screen.getByText(`Entity #${entityA}`));
    expect(await screen.findByText(`Inspector — Entity #${entityA}`)).toBeTruthy();

    fireEvent.click(screen.getByText(`Entity #${entityB}`));
    expect(await screen.findByText(`Inspector — Entity #${entityB}`)).toBeTruthy();
    expect(container.querySelector('[data-selected-entity]')?.getAttribute('data-selected-entity')).toBe(String(entityB));
  });
});
