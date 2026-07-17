import { vi } from 'vitest';

/**
 * Mock mínimo pero fiel de la cadena Web Audio API. No implementa
 * procesamiento de audio real (no hace falta para estos tests) - solo
 * trackea conexiones entre nodos y valores de gain, que es exactamente
 * lo que el checklist pide verificar (jerarquía de 3 niveles, volumen
 * combinado).
 */
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
    if (this.stopped) throw new Error('ya detenido'); // imita el comportamiento real de algunos navegadores
    this.stopped = true;
  }

  /** Helper de test: simula que el navegador disparó 'ended' de forma natural. */
  simulateNaturalEnd(): void {
    this.onended?.();
  }
}

export class MockAudioContext {
  state: 'suspended' | 'running' = 'suspended';
  destination = new MockGainNode();
  sampleRate = 44100;

  createGain(): MockGainNode {
    return new MockGainNode();
  }

  createBufferSource(): MockAudioBufferSourceNode {
    return new MockAudioBufferSourceNode();
  }

  createBuffer(_channels: number, _length: number, _sampleRate: number): unknown {
    return { duration: 0 }; // buffer silencioso del truco de desbloqueo, no necesita ser real
  }

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
}

export function installAudioContextMock(): void {
  vi.stubGlobal('AudioContext', MockAudioContext);
}
