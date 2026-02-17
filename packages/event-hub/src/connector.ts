import { EventHub } from './event-hub';
import { Pipeline } from './pipeline';
import { ISinkTransport, MessageHandler, SourceTransport } from './transport';
import { Subscription } from './types';

/**
 * Inbound data flow: transport → pipeline → EventHub channel.
 * Concrete class — attaches as listener to a shared transport.
 *
 * @template TInput  The type of raw data received from the transport
 * @template TOutput The type of processed data published to the EventHub
 */
export class SourceConnector<TInput, TOutput = TInput> {
    readonly eventHub: EventHub;
    readonly transport: SourceTransport<TInput>;
    protected channel: string;
    private pipeline?: Pipeline<TInput, TOutput>;
    private handler?: MessageHandler<TInput>;

    constructor(
        eventHub: EventHub,
        transport: SourceTransport<TInput>,
        channel: string,
    ) {
        this.eventHub = eventHub;
        this.transport = transport;
        this.channel = channel;
    }

    use(pipeline: Pipeline<TInput, TOutput>): this {
        this.pipeline = pipeline;
        return this;
    }

    async connect(): Promise<void> {
        // Idempotent: remove old handler before adding new
        if (this.handler) {
            this.transport.removeListener(this.handler);
        }

        this.handler = async (data: TInput) => {
            try {
                if (this.pipeline) {
                    const result = await this.pipeline.process(data);
                    if (!result.success) return;
                    if (result.data === null || result.data === undefined) return;
                    await this.eventHub.publish(this.channel, result.data);
                } else {
                    await this.eventHub.publish(this.channel, data);
                }
            } catch {
                // Pipeline/publish errors caught — do not propagate to transport
            }
        };

        this.transport.addListener(this.handler);

        if (!this.transport.isConnected()) {
            await this.transport.connect();
        }
    }

    async disconnect(): Promise<void> {
        if (this.handler) {
            this.transport.removeListener(this.handler);
        }
    }
}

/**
 * Outbound data flow: EventHub channel → pipeline → transport.
 * Concrete class — subscribes to hub and forwards to an ISinkTransport.
 *
 * @template TInput  The type of data received from the EventHub
 * @template TOutput The type of processed data sent to the transport
 */
export class SinkConnector<TInput, TOutput = TInput> {
    readonly eventHub: EventHub;
    readonly transport: ISinkTransport<TOutput>;
    readonly channel: string;
    private pipeline?: Pipeline<TInput, TOutput>;
    protected subscription?: Subscription;

    constructor(
        eventHub: EventHub,
        transport: ISinkTransport<TOutput>,
        channel: string,
    ) {
        this.eventHub = eventHub;
        this.transport = transport;
        this.channel = channel;
    }

    use(pipeline: Pipeline<TInput, TOutput>): this {
        this.pipeline = pipeline;
        return this;
    }

    async connect(): Promise<void> {
        this.subscription = this.eventHub.subscribe(this.channel, async (data: TInput) => {
            try {
                if (this.pipeline) {
                    const result = await this.pipeline.process(data);
                    if (!result.success) return;
                    if (result.data === null || result.data === undefined) return;
                    await this.transport.send(result.data);
                } else {
                    await this.transport.send(data as unknown as TOutput);
                }
            } catch {
                // Pipeline/send errors caught — do not propagate
            }
        });

        if (!this.transport.isConnected()) {
            await this.transport.connect();
        }
    }

    async disconnect(): Promise<void> {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }
}
