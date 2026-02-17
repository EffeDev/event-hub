import { SinkConnector, SourceConnector } from './connector';
import { EventHub } from './event-hub';
import { InMemoryTransport } from './in-memory-transport';
import { Pipeline, PipelineResult } from './pipeline';
import { ISinkTransport } from './transport';

// --- T023: InMemoryTransport unit tests ---

describe('InMemoryTransport', () => {
    let transport: InMemoryTransport<string>;

    beforeEach(() => {
        transport = new InMemoryTransport<string>('test-imt');
    });

    it('should connect and set connected state', async () => {
        await transport.connect();
        expect(transport.isConnected()).toBe(true);
    });

    it('should disconnect and set disconnected state', async () => {
        await transport.connect();
        await transport.disconnect();
        expect(transport.isConnected()).toBe(false);
    });

    it('should clear listeners on disconnect', async () => {
        await transport.connect();
        transport.addListener(async () => {});
        await transport.disconnect();
        // After reconnect, no listeners should fire
        await transport.connect();
        // If listeners were cleared, send should just broadcast to empty set
        await transport.send('data');
    });

    it('should broadcast data to all listeners via send', async () => {
        await transport.connect();
        const results: string[] = [];
        transport.addListener(async (data) => { results.push(`a:${data}`); });
        transport.addListener(async (data) => { results.push(`b:${data}`); });

        await transport.send('hello');

        expect(results).toContain('a:hello');
        expect(results).toContain('b:hello');
        expect(results).toHaveLength(2);
    });

    it('should throw when sending while not connected', async () => {
        await expect(transport.send('data')).rejects.toThrow('Transport not connected');
    });

    it('should be no-op when sending with no listeners', async () => {
        await transport.connect();
        await expect(transport.send('data')).resolves.toBeUndefined();
    });

    it('should implement ISinkTransport interface', () => {
        const sink: ISinkTransport<string> = transport;
        expect(sink.send).toBeDefined();
        expect(sink.connect).toBeDefined();
        expect(sink.disconnect).toBeDefined();
        expect(sink.isConnected).toBeDefined();
    });

    it('should use default name when none provided', () => {
        const t = new InMemoryTransport();
        expect(t.name).toBe('in-memory-transport');
    });
});

// --- T024: Hub-to-Hub Federation tests ---

describe('Hub-to-Hub Federation', () => {
    it('should forward events unidirectionally from hub A to hub B', async () => {
        const hubA = new EventHub();
        const hubB = new EventHub();

        const transport = new InMemoryTransport<string>('a-to-b');

        const sinkA = new SinkConnector<string>(hubA, transport, 'shared');
        const sourceB = new SourceConnector<string>(hubB, transport, 'from-a');

        await sinkA.connect();
        await sourceB.connect();

        const received: string[] = [];
        hubB.subscribe('from-a', (data: string) => { received.push(data); });

        await hubA.publish('shared', 'hello from A');

        expect(received).toEqual(['hello from A']);
    });

    it('should support bidirectional federation', async () => {
        const hubA = new EventHub();
        const hubB = new EventHub();

        // A → B
        const aToBTransport = new InMemoryTransport<string>('a-to-b');
        const sinkA = new SinkConnector<string>(hubA, aToBTransport, 'outbound-a');
        const sourceB = new SourceConnector<string>(hubB, aToBTransport, 'from-a');

        // B → A
        const bToATransport = new InMemoryTransport<string>('b-to-a');
        const sinkB = new SinkConnector<string>(hubB, bToATransport, 'outbound-b');
        const sourceA = new SourceConnector<string>(hubA, bToATransport, 'from-b');

        await sinkA.connect();
        await sourceB.connect();
        await sinkB.connect();
        await sourceA.connect();

        const receivedAtB: string[] = [];
        const receivedAtA: string[] = [];

        hubB.subscribe('from-a', (data: string) => { receivedAtB.push(data); });
        hubA.subscribe('from-b', (data: string) => { receivedAtA.push(data); });

        await hubA.publish('outbound-a', 'msg-from-a');
        await hubB.publish('outbound-b', 'msg-from-b');

        expect(receivedAtB).toEqual(['msg-from-a']);
        expect(receivedAtA).toEqual(['msg-from-b']);
    });

    it('should filter events via connector pipeline', async () => {
        const hubA = new EventHub();
        const hubB = new EventHub();

        const transport = new InMemoryTransport<{ type: string; value: number }>('filtered');

        const sinkA = new SinkConnector<{ type: string; value: number }>(hubA, transport, 'events');

        const filterPipeline = new Pipeline<{ type: string; value: number }>()
            .add<{ type: string; value: number }>({
                async process(data: { type: string; value: number }): Promise<PipelineResult<{ type: string; value: number }>> {
                    if (data.type !== 'important') {
                        return { success: false };
                    }
                    return { success: true, data };
                },
            });

        const sourceB = new SourceConnector<{ type: string; value: number }>(hubB, transport, 'important-events')
            .use(filterPipeline);

        await sinkA.connect();
        await sourceB.connect();

        const received: { type: string; value: number }[] = [];
        hubB.subscribe('important-events', (data: { type: string; value: number }) => { received.push(data); });

        await hubA.publish('events', { type: 'important', value: 1 });
        await hubA.publish('events', { type: 'debug', value: 2 });
        await hubA.publish('events', { type: 'important', value: 3 });

        expect(received).toEqual([
            { type: 'important', value: 1 },
            { type: 'important', value: 3 },
        ]);
    });

    it('should stop forwarding when transport is disconnected', async () => {
        const hubA = new EventHub();
        const hubB = new EventHub();

        const transport = new InMemoryTransport<string>('stoppable');

        const sinkA = new SinkConnector<string>(hubA, transport, 'events');
        const sourceB = new SourceConnector<string>(hubB, transport, 'forwarded');

        await sinkA.connect();
        await sourceB.connect();

        const received: string[] = [];
        hubB.subscribe('forwarded', (data: string) => { received.push(data); });

        await hubA.publish('events', 'before-disconnect');
        expect(received).toEqual(['before-disconnect']);

        await transport.disconnect();

        // After disconnect, publishing should not forward (send throws, caught by connector)
        await hubA.publish('events', 'after-disconnect');
        expect(received).toEqual(['before-disconnect']);
    });
});
