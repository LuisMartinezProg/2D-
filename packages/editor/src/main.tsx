import { World } from '@mochigo/ecs';
import { EventBus } from '@mochigo/events';
import { Renderer } from '@mochigo/renderer';
import { SceneManager } from '@mochigo/scenes';
import { AssetManager } from '@mochigo/assets';
import { Editor } from './Editor';

const eventBus = new EventBus();
const world = new World();

const canvas = document.createElement('canvas');
const assetManager = new AssetManager(eventBus);

const renderer = new Renderer(
  {
    canvas,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#080810', // Skirk black, del theme MochiGo
    pixelArt: true,
  },
  assetManager,
  eventBus
);

const sceneManager = new SceneManager(world, assetManager, eventBus);

const mountElement = document.getElementById('root');
if (!mountElement) {
  throw new Error('No se encontró el elemento #root para montar el editor.');
}

const editor = new Editor({
  world,
  eventBus,
  renderer,
  sceneManager,
  assetManager,
  mountElement,
});

editor.mount();

// Escena vacía inicial: sin esto, serializeCurrentScene() (que usa
// EditorApp para listar texturas conocidas) lanza porque no hay
// ninguna escena cargada todavía al abrir el editor.
sceneManager.loadScene({ name: 'Escena sin título', manifest: [], entities: [] });
