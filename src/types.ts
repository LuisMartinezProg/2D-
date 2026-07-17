export type EventPayload = Record<string, unknown>;
export type EventCallback<T extends EventPayload = EventPayload> = (payload: T) => void;
