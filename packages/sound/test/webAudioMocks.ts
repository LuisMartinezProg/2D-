import { vi } from 'vitest';

export class MockGainNode {
  gain = { value: 1 };
  connectedTo: MockGainNode[] = [];
  connect(destination: MockGainNode): void {
    this.connectedTo.push(destination);
  }
  disconnect(): void {
    this.connectedTo = [];
  }
}

export class MockAudioBufferSourceNode {
  buffer: unknown = null;
  loop = false;
  onended: (() => void) | null = null;
  private started = false;
  private stopped = false;
  connectedTo: MockGainNode[] = [];

  connect(destination: MockGainNode): void {
    this.connectedTo.push(destination);
  }
  disconnect(): void {
    this.connectedTo = [];
  }
  start(_when?: number): void {
    this.started = true;
  }
  stop(): void {
    if (this.stopped) throw new Error('ya detenido');
    this.stopped = true;
  }
  simulateNaturalEnd(): void {
    this.onended?.();
  }
}

export class MockAudioContext {
  state: 'suspended' | 'running' = 'suspended';
  destination = new MockGainNode();
  sampleRate = 44100;

  // Registro de todas las fuentes creadas por ESTA instancia de
  // contexto, en orden - permite que los tests accedan "la última
  // fuente creada" sin que SoundManager necesite exponer nada nuevo en
  // su interfaz pública solo para hacerlo testeable.
  createdSources: MockAudioBufferSourceNode[] = [];

  createGain(): MockGainNode {
    return new MockGainNode();
  }

  createBufferSource(): MockAudioBufferSourceNode {
    const source = new MockAudioBufferSourceNode();
    this.createdSources.push(source);
    return source;
  }

  createBuffer(_channels: number, _length: number, _sampleRate: number): unknown {
    return { duration: 0 };
  }

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
}

// Referencia a la ÚLTIMA instancia de MockAudioContext creada - permite
// que los tests accedan al contexto real que SoundManager instanció
// internamente, sin que SoundManager necesite exponerlo.
let lastCreatedInstance: MockAudioContext | null = null;

export function installAudioContextMock(): void {
  class TrackedMockAudioContext extends MockAudioContext {
    constructor() {
      super();
      lastCreatedInstance = this;
    }
  }
  vi.stubGlobal('AudioContext', TrackedMockAudioContext);
}

export function getLastAudioContextInstance(): MockAudioContext {
  if (!lastCreatedInstance) {
    throw new Error('No se creó ningún AudioContext todavía en este test.');
  }
  return lastCreatedInstance;
}
