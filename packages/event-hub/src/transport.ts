/**
 * Interface for transport implementations that handle remote event source connections
 *
 * @property name - A unique identifier for the transport instance
 */
export interface ITransport {
    readonly name: string;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
}

/**
 * Type definition for a function that handles incoming messages
 * @template T The type of data being handled
 */
export type MessageHandler<T> = (data: T) => Promise<void>;

/**
 * Interface for transport implementations that can send data to a destination
 *
 * @template T The type of data being sent
 */
export interface ISinkTransport<T> extends ITransport {
    send(data: T): Promise<void>;
}

/**
 * Base class providing common functionality for all transport implementations.
 * Manages connection state and listener registration.
 *
 * @template T The type of data flowing through this transport
 */
export abstract class BaseTransport<T> implements ITransport {
    readonly name: string;
    protected _connected: boolean = false;
    protected listeners: Set<MessageHandler<T>> = new Set();

    constructor(name: string) {
        this.name = name;
    }

    abstract connect(): Promise<void>;
    abstract disconnect(): Promise<void>;

    isConnected() {
        return this._connected;
    }

    checkConnected(): void {
        if (!this.isConnected()) {
            throw new Error('Transport not connected');
        }
    }

    addListener(handler: MessageHandler<T>): void {
        this.listeners.add(handler);
    }

    removeListener(handler: MessageHandler<T>): void {
        this.listeners.delete(handler);
    }
}

/**
 * Transport implementation for receiving data from remote event sources.
 * Broadcasts received data to all attached listeners.
 *
 * @template T The type of data received from the source
 */
export abstract class SourceTransport<T> extends BaseTransport<T> {
    protected async broadcast(data: T): Promise<void> {
        for (const listener of this.listeners) {
            try {
                await listener(data);
            } catch {
                // Errors isolated per listener
            }
        }
    }
}

/**
 * Transport implementation for sending data to remote event destinations.
 * Sends data directly without pipeline processing.
 *
 * @template T The type of data to be sent
 */
export abstract class SinkTransport<T> extends BaseTransport<T> implements ISinkTransport<T> {
    abstract connect(): Promise<void>;

    protected abstract sendMessage(data: T): Promise<void>;

    async send(data: T): Promise<void> {
        this.checkConnected();
        await this.sendMessage(data);
    }
}
