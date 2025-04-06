import { Pipeline } from './pipeline';
import { isDefined } from './types';

/**
 * Interface for transport implementations that handle remote event source connections
 * 
 * @description
 * The ITransport interface defines the basic contract for transport implementations
 * that connect to remote event sources. A transport is responsible for establishing
 * and managing the connection to a remote system.
 * 
 * @property name - A unique identifier for the transport instance
 */
export interface ITransport {
    readonly name: string;
    /**
     * Establishes a connection to the remote event source
     * @throws {Error} If connection fails
     */
    connect(): Promise<void>;
    /**
     * Terminates the connection to the remote event source
     * @throws {Error} If disconnection fails
     */
    disconnect(): Promise<void>;

    /**
     * Returns the connected state of the transport
     * @returns boolean 
     */
    isConnected(): boolean;
}

/**
 * Type definition for a function that handles incoming messages
 * @template T The type of data being handled
 */
type MessageHandler<T> = (data: T) => Promise<void>;

/**
 * Base class providing common functionality for all transport implementations
 * 
 * @template TInput The type of data that enters the transport
 * @template TOutput The type of data that exits the transport after processing
 * 
 * @description
 * BaseTransport provides core functionality shared by all transport implementations,
 * including pipeline support for data transformation and basic connection management.
 * This class should be extended by specific transport implementations.
 * 
 * @example
 * class MyTransport extends BaseTransport<string, number> {
 *   async connect() {
 *     // Implementation specific connection logic
 *   }
 *   
 *   async disconnect() {
 *     // Implementation specific disconnection logic
 *   }
 * }
 * 
 * const transport = new MyTransport("my-transport");
 * transport.usePipeline(new Pipeline<string, number>());
 * await transport.connect();
 */
export abstract class BaseTransport<TInput, TOutput = TInput> implements ITransport {
    /** Optional pipeline for data transformation */
    protected pipeline?: Pipeline<TInput, TOutput>
    /** Unique identifier for this transport instance */
    readonly name: string;
    protected _connected: boolean = false;

    /**
     * Creates a new transport instance
     * @param name Unique identifier for this transport
     */
    constructor(
        name: string,
    ) {
        this.name = name;
    }

    /**
     * Establishes connection to the remote event source
     * @abstract
     * @throws {Error} If connection fails
     */
    abstract connect(): Promise<void>;

    /**
     * Terminates connection to the remote event source
     * @abstract
     * @throws {Error} If disconnection fails
     */
    abstract disconnect(): Promise<void>;

    /**
     * Returns transport connected state
     * @returns boolean
     */
    isConnected() {
        return this._connected
    }

    /**
     * Checks if the transport is connected
     * @throws {Error} If transport is not connected
     */
    checkConnected() : void {
        if (!this.isConnected()) {
            throw new Error('Transport not connected');
        }
    }
    
    /**
     * Configures a data processing pipeline for this transport
     * 
     * @description
     * The pipeline will be applied to all data flowing through this transport.
     * Each stage in the pipeline can transform, filter, or validate the data.
     * 
     * @param pipeline The pipeline to use for data processing
     * 
     * @example
     * const transport = new MyTransport("my-transport");
     * const pipeline = new Pipeline<string, number>();
     * transport.usePipeline(pipeline.add({
     *   async process(data: string) {
     *     return { success: true, data: parseInt(data) };
     *   }
     * }));
     */
    usePipeline(pipeline: Pipeline<TInput, TOutput>) {
        this.pipeline = pipeline
    }
}

/**
 * Transport implementation for receiving data from remote event sources
 * 
 * @template TInput The type of raw data received from the source
 * @template TOutput The type of processed data after pipeline transformation
 * 
 * @description
 * SourceTransport extends BaseTransport to provide functionality specific to
 * receiving data from remote sources. It adds message handling capabilities
 * and ensures received data is processed through the configured pipeline.
 * 
 * @example
 * class WebSocketSource extends SourceTransport<string, object> {
 *   private ws: WebSocket;
 *   
 *   async connect() {
 *     this.ws = new WebSocket("ws://example.com");
 *     this.ws.onmessage = async (msg) => {
 *       // Process received message through pipeline
 *       await this.messageHandler(JSON.parse(msg.data));
 *     };
 *   }
 * }
 */
export abstract class SourceTransport<TInput, TOutput = TInput> extends BaseTransport<TInput, TOutput> {
    /**
     * Handler function for processing received messages
     * @private
     */
    protected _onDataHandler?: MessageHandler<TOutput>;

    /**
     * Processes the received data with the Pipeline to filter, transform etc
     * @throws {Error} If no message handler has been defined
     */
    async messageHandler(data: TInput) : Promise<void> {
        this.checkConnected();
        if (!this._onDataHandler) {
            throw new Error('No message handler defined');
        }
        if (this.pipeline) {
            const result = await this.pipeline.process(data);
            if (result.success) {
                if (isDefined(result.data)) {
                    await this._onDataHandler!(result.data);
                }
            } else {
                throw result.error;
            }
        } else {
            // if there is no pipeline then TOutput === TInput
            await this._onDataHandler!(data as unknown as TOutput);
        }
    }

    /**
     * Registers a handler function for received messages
     * 
     * @param handler Function to be called when messages are received
     * 
     * @example
     * const source = new WebSocketSource("ws-source");
     * source.onData(async (data) => {
     *   console.log("Received:", data);
     * });
     */
    onData(handler: MessageHandler<TOutput>): void {
        this._onDataHandler = handler
    }
}

/**
 * Transport implementation for sending data to remote event destinations
 * 
 * @template TInput The type of data to be sent
 * @template TOutput The type of processed data after pipeline transformation
 * 
 * @description
 * SinkTransport extends BaseTransport to provide functionality specific to
 * sending data to remote destinations. It adds the send method and ensures
 * outgoing data is processed through the configured pipeline.
 * 
 * @example
 * class WebSocketSink extends SinkTransport<object, string> {
 *   private ws: WebSocket;
 *   
 *   async connect() {
 *     this.ws = new WebSocket("ws://example.com");
 *   }
 *   
 *   async send(data: string) {
 *     this.ws.send(data);
 *   }
 * }
 */
export abstract class SinkTransport<TInput, TOutput = TInput> extends BaseTransport<TInput, TOutput> {

    /**
     * Connects to the remote destination
     * 
     * @abstract
     */
    abstract connect(): Promise<void>;

    /**
     * Sends data to the remote destination
     *
     * @abstract
     * @param data 
     */
    protected abstract sendMessage(data: TOutput): Promise<void>;

    /**
     * Sends data to the remote destination after processing the Pipeline filters
     * 
     * @param data The data to send
     * @throws {Error} If transport is not connected
     * 
     * @example
     * const sink = new WebSocketSink("ws-sink");
     * await sink.connect();
     * await sink.send({ message: "Hello" });
     */
    async send(data: TInput) : Promise<void> {
        this.checkConnected();
        if (this.pipeline) {
            const result = await this.pipeline.process(data);
            if (result.success) {
                if (isDefined(result.data)) {
                    await this.sendMessage(result.data);
                }
            } else {
                throw result!.error;
            }
        } else {
            // if there is no pipeline then TOutput === TInput
            await this.sendMessage(data as unknown as TOutput);
        }
    }
}

