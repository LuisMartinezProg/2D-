import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../src/EventBus';

describe('EventBus — on/emit', () => {
  it('suscribir y emitir entrega el payload correcto', () => {
    const bus = new EventBus();
    const callback = vi.fn();
    bus.on('test:event', callback);
    bus.emit('test:event', { value: 42 });
    expect(callback).toHaveBeenCalledWith({ value: 42 });
  });

  it('varios suscriptores al mismo evento reciben el payload, en orden de suscripción', () => {
    const bus = new EventBus();
    const order: string[] = [];
    bus.on('test:event', () => order.push('first'));
    bus.on('test:event', () => order.push('second'));
    bus.emit('test:event', {});
    expect(order).toEqual(['first', 'second']);
  });

  it('emit en un evento sin suscriptores no lanza error', () => {
    const bus = new EventBus();
    expect(() => bus.emit('nadie:escucha', {})).not.toThrow();
  });
});

describe('EventBus — off', () => {
  it('deja de recibir el evento después de off', () => {
    const bus = new EventBus();
    const callback = vi.fn();
    bus.on('test:event', callback);
    bus.off('test:event', callback);
    bus.emit('test:event', {});
    expect(callback).not.toHaveBeenCalled();
  });

  it('off con un callback no suscrito es no-op seguro', () => {
    const bus = new EventBus();
    expect(() => bus.off('test:event', vi.fn())).not.toThrow();
  });
});

describe('EventBus — once', () => {
  it('se dispara solo una vez', () => {
    const bus = new EventBus();
    const callback = vi.fn();
    bus.once('test:event', callback);
    bus.emit('test:event', { n: 1 });
    bus.emit('test:event', { n: 2 });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ n: 1 });
  });

  it('once no afecta a otros listeners on() del mismo evento', () => {
    const bus = new EventBus();
    const onceCb = vi.fn();
    const onCb = vi.fn();
    bus.once('test:event', onceCb);
    bus.on('test:event', onCb);
    bus.emit('test:event', {});
    bus.emit('test:event', {});
    expect(onceCb).toHaveBeenCalledTimes(1);
    expect(onCb).toHaveBeenCalledTimes(2);
  });
});

describe('EventBus — clear', () => {
  it('clear() sin argumento limpia todos los eventos', () => {
    const bus = new EventBus();
    const cbA = vi.fn();
    const cbB = vi.fn();
    bus.on('event:a', cbA);
    bus.on('event:b', cbB);
    bus.clear();
    bus.emit('event:a', {});
    bus.emit('event:b', {});
    expect(cbA).not.toHaveBeenCalled();
    expect(cbB).not.toHaveBeenCalled();
  });

  it('clear(eventName) limpia solo ese evento', () => {
    const bus = new EventBus();
    const cbA = vi.fn();
    const cbB = vi.fn();
    bus.on('event:a', cbA);
    bus.on('event:b', cbB);
    bus.clear('event:a');
    bus.emit('event:a', {});
    bus.emit('event:b', {});
    expect(cbA).not.toHaveBeenCalled();
    expect(cbB).toHaveBeenCalled();
  });
});

describe('EventBus — manejo de excepciones', () => {
  it('un callback que lanza no interrumpe a los demás suscritos al mismo evento', () => {
    const bus = new EventBus();
    const cbThatThrows = vi.fn(() => { throw new Error('boom'); });
    const cbAfter = vi.fn();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    bus.on('test:event', cbThatThrows);
    bus.on('test:event', cbAfter);
    bus.emit('test:event', {});

    expect(cbThatThrows).toHaveBeenCalled();
    expect(cbAfter).toHaveBeenCalled(); // la clave del test: sí se ejecuta pese al throw anterior
    consoleSpy.mockRestore();
  });
});
