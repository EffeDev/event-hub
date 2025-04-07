/**
 * Core Connector Classes
 * 
 * @description
 * Connectors are one-way data flow components that connect to a transport 
 * and publish/subscribe to the EventHub. They provide the bridge between
 * external data sources/sinks and the internal event system.
 */
import { EventHub } from './event-hub';
import { SinkTransport,SourceTransport } from './transport';
import { Subscription } from './types';

/**
 * Implements an inbound data flow from an external transport to the EventHub
 * 
 * @template TInput The type of raw data received from the transport
 * @template TOutput The type of processed data published to the EventHub
 * 
 * @description
 * SourceConnector establishes a one-way data flow from an external source into the EventHub.
 * It connects to a source transport that receives data from an external system and publishes
 * that data to a specified channel in the EventHub.
 * 
 * @example
 * class WebSocketSourceConnector extends SourceConnector<string, object> {
 *   constructor(eventHub: EventHub) {
 *     super(
 *       eventHub,
 *       new WebSocketTransport("wss://api.example.com"),
 *       "websocket-events"
 *     );
 *   }
 * }
 * 
 * const connector = new WebSocketSourceConnector(eventHub);
 * await connector.connect();
 * // Now websocket messages will be published to "websocket-events" channel
 */
export abstract class SourceConnector<TInput, TOutput> {
    /** The EventHub instance where events will be published */
    readonly eventHub: EventHub;
    /** The transport that receives data from the external source */
    readonly transport: SourceTransport<TInput, TOutput>;
    /** The channel where received events will be published */
    protected channel: string;

    /**
     * Creates a new SourceConnector instance
     * 
     * @param eventHub The EventHub instance to publish events to
     * @param transport The transport that will receive external data
     * @param channel The channel name where events will be published
     */
    constructor(
        eventHub: EventHub,
        transport: SourceTransport<TInput, TOutput>,
        channel: string
    ) {
        this.eventHub = eventHub;
        this.transport = transport;
        this.channel = channel;
    }
    
    /**
     * Establishes the connection to the external source
     * 
     * @description
     * This method performs two steps:
     * 1. Registers a handler with the transport to publish received data to the EventHub
     * 2. Connects the transport to start receiving data
     * 
     * @throws {Error} If connection fails or EventHub is not available
     */
    async connect(): Promise<void> {
        // First register the EventHub Handler
        this.transport.onData(async (data: TOutput) => {
            await this.eventHub.publish(this.channel, data);
        });

        await this.transport.connect();
    };

    /**
     * Terminates the connection to the external source
     * 
     * @description
     * Disconnects the transport, which stops the flow of data from the external source.
     * Any queued or in-flight messages may be lost.
     * 
     * @throws {Error} If disconnection fails
     */
    async disconnect(): Promise<void> {
        await this.transport.disconnect();
    }
}

/**
 * Implements an outbound data flow from the EventHub to an external transport
 * 
 * @template TInput The type of data received from the EventHub
 * @template TOutput The type of processed data sent to the transport
 * 
 * @description
 * SinkConnector establishes a one-way data flow from the EventHub to an external system.
 * It subscribes to a specified channel in the EventHub and forwards all events to a
 * sink transport that sends the data to an external system.
 * 
 * @example
 * class WebSocketSinkConnector extends SinkConnector<object, string> {
 *   constructor(eventHub: EventHub) {
 *     super(
 *       eventHub,
 *       new WebSocketTransport("wss://api.example.com"),
 *       "outbound-events"
 *     );
 *   }
 * }
 * 
 * const connector = new WebSocketSinkConnector(eventHub);
 * await connector.connect();
 * // Now events published to "outbound-events" will be sent to the websocket
 */
export abstract class SinkConnector<TInput, TOutput> {
    /** The EventHub instance to subscribe to for events */
    readonly eventHub: EventHub;
    /** The transport that sends data to the external system */
    readonly transport: SinkTransport<TInput, TOutput>;
    /** The channel to subscribe to for events */
    readonly channel: string;
    /** The subscription to the EventHub channel */
    protected subscription?: Subscription;

    /**
     * Creates a new SinkConnector instance
     * 
     * @param eventHub The EventHub instance to subscribe to
     * @param transport The transport that will send data externally
     * @param channel The channel name to subscribe to
     */
    constructor(
        eventHub: EventHub,
        transport: SinkTransport<TInput, TOutput>,
        channel: string
    ) {
        this.eventHub = eventHub;
        this.transport = transport;
        this.channel = channel;
    }
    
    /**
     * Establishes the connection to the external system
     * 
     * @description
     * This method performs two steps:
     * 1. Subscribes to the specified EventHub channel
     * 2. Connects the transport to enable sending data
     * 
     * @throws {Error} If connection fails or EventHub is not available
     */
    connect(): Promise<void> {
        // Subscribe to the Channel to receive events
        this.subscription = this.eventHub.subscribe(this.channel, async (data: TInput) => {
            await this.transport.send(data);
        });

        return this.transport.connect();
    }

    /**
     * Terminates the connection to the external system
     * 
     * @description
     * This method:
     * 1. Unsubscribes from the EventHub channel to stop receiving events
     * 2. Disconnects the transport
     * Any queued or in-flight messages may be lost.
     * 
     * @throws {Error} If disconnection fails
     */
    disconnect(): Promise<void> {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
        return this.transport.disconnect();
    }
}
