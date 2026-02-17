import { ISinkTransport, SourceTransport } from './transport';

/**
 * In-memory transport for connecting EventHub instances.
 * Extends SourceTransport (broadcast) and implements ISinkTransport (send).
 * Enables hub-to-hub federation without network I/O.
 *
 * @template T The type of data flowing through this transport
 */
export class InMemoryTransport<T = unknown>
    extends SourceTransport<T>
    implements ISinkTransport<T> {

    constructor(name = 'in-memory-transport') {
        super(name);
    }

    async connect(): Promise<void> {
        this._connected = true;
    }

    async disconnect(): Promise<void> {
        this._connected = false;
        this.listeners.clear();
    }

    async send(data: T): Promise<void> {
        this.checkConnected();
        await this.broadcast(data);
    }
}
