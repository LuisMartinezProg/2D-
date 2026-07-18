import * as ReactDOM from 'react-dom/client';
import React from 'react';
import type { World, EntityId, ComponentClass } from '@mochigo/ecs';
import { Transform } from '@mochigo/ecs';
import type { EventBus } from '@mochigo/events';
import type { Renderer } from '@mochigo/renderer';
import { Sprite, Camera } from '@mochigo/renderer';
import type { SceneManager } from '@mochigo/scenes';
import type { AssetManager } from '@mochigo/assets';
import type { ScriptComponentClass, ComponentSchema } from '@mochigo/scripting';
import { RigidBody, Collider } from '@mochigo/physics';
import { Animator } from '@mochigo/animation';
import { EditorState } from './EditorState';
import { EditorApp } from './EditorApp';

export interface EditorConfig {
  world: World; eventBus: EventBus; renderer: Renderer;
  sceneManager: SceneManager; assetManager: AssetManager; mountElement: HTMLElement;
}

export class Editor {
  private readonly state: EditorState;
  private root: ReactDOM.Root | null = null;

  private readonly componentRegistry = new Map<string, ComponentClass<any>>([
    [Transform.componentName, Transform],
    [Sprite.componentName, Sprite],
    [Camera.componentName, Camera],
    [RigidBody.componentName, RigidBody],
    [Collider.componentName, Collider],
    [Animator.componentName, Animator],
  ]);

  private readonly scriptSchemas = new Map<string, ComponentSchema>();

  constructor(private readonly config: EditorConfig) {
    this.state = new EditorState(config.world, config.eventBus, config.sceneManager);
  }

  /** Mismo patrón que SceneManager.registerComponent() y
   * ScriptingSystem.registerScriptClass(): cada módulo que necesita
   * conocer tipos definidos por el usuario expone su propio register*(). */
  registerScriptComponent(scriptClass: ScriptComponentClass): void {
    this.componentRegistry.set(scriptClass.componentName, scriptClass as unknown as ComponentClass<any>);
    this.scriptSchemas.set(scriptClass.componentName, scriptClass.schema);
  }

  mount(): void {
    this.root = ReactDOM.createRoot(this.config.mountElement);
    this.root.render(
      React.createElement(EditorApp, {
        world: this.config.world, eventBus: this.config.eventBus, renderer: this.config.renderer,
        sceneManager: this.config.sceneManager, assetManager: this.config.assetManager,
        editorState: this.state, componentRegistry: this.componentRegistry, scriptSchemas: this.scriptSchemas,
      })
    );
  }

  unmount(): void {
    this.root?.unmount();
    this.root = null;
  }

  selectEntity(entity: EntityId | null): void { this.state.selectEntity(entity); }
  getSelectedEntity(): EntityId | null { return this.state.getSelectedEntity(); }
  enterPlayMode(): void { this.state.enterPlayMode(); }
  async exitPlayMode(): Promise<void> { await this.state.exitPlayMode(); }
  isInPlayMode(): boolean { return this.state.isInPlayMode(); }
}
