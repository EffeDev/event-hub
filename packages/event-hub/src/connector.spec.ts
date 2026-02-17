import { SinkConnector, SourceConnector } from './connector';
import { EventHub } from './event-hub';
import { Pipeline, PipelineResult } from './pipeline';
import { ISinkTransport, SourceTransport } from './transport';

// --- Mock Transport implementations ---

class MockSourceTransport extends SourceTransport<string> {
    async connect(): Promise<void> {
        this._connected = true;
    }

    async disconnect(): Promise<void> {
        this._connected = false;
    }

    public exposeBroadcast(data: string): Promise<void> {
        return this.broadcast(data);
    }
}

class MockSinkTransport implements ISinkTransport<string> {
    public sentMessages: string[] = [];
    private _connected = false;
    readonly name = 'mock-sink';

    async connect(): Promise<void> {
        this._connected = true;
    }

    async disconnect(): Promise<void> {
        this._connected = false;
    }

    isConnected(): boolean {
        return this._connected;
    }

    async send(data: string): Promise<void> {
        if (!this._connected) {
            throw new Error('Transport not connected');
        }
        this.sentMessages.push(data);
    }
}

// --- SourceConnector Tests (T009) ---

describe('SourceConnector', () => {
    let eventHub: EventHub;
    let transport: MockSourceTransport;
    const channelName = 'test-channel';

    beforeEach(() => {
        eventHub = new EventHub();
        transport = new MockSourceTransport('test-source-transport');
    });

    it('should be instantiable directly (not abstract)', () => {
        const connector = new SourceConnector(eventHub, transport, channelName);
        expect(connector).toBeInstanceOf(SourceConnector);
    });

    it('should initialize with correct properties', () => {
        const connector = new SourceConnector(eventHub, transport, channelName);
        expect(connector.eventHub).toBe(eventHub);
        expect(connector.transport).toBe(transport);
    });

    it('should attach listener to transport on connect', async () => {
        const connector = new SourceConnector(eventHub, transport, channelName);
        const addListenerSpy = jest.spyOn(transport, 'addListener');

        await connector.connect();

        expect(addListenerSpy).toHaveBeenCalledTimes(1);
        expect(addListenerSpy).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should establish transport connection if not already connected', async () => {
        const connector = new SourceConnector(eventHub, transport, channelName);
        const connectSpy = jest.spyOn(transport, 'connect');

        await connector.connect();

        expect(connectSpy).toHaveBeenCalledTimes(1);
        expect(transport.isConnected()).toBe(true);
    });

    it('should reuse existing transport connection', async () => {
        await transport.connect();
        const connector = new SourceConnector(eventHub, transport, channelName);
        const connectSpy = jest.spyOn(transport, 'connect');

        await connector.connect();

        expect(connectSpy).not.toHaveBeenCalled();
    });

    it('should remove listener on disconnect but NOT disconnect transport', async () => {
        const connector = new SourceConnector(eventHub, transport, channelName);
        const removeListenerSpy = jest.spyOn(transport, 'removeListener');
        const disconnectSpy = jest.spyOn(transport, 'disconnect');

        await connector.connect();
        await connector.disconnect();

        expect(removeListenerSpy).toHaveBeenCalledTimes(1);
        expect(disconnectSpy).not.toHaveBeenCalled();
        expect(transport.isConnected()).toBe(true);
    });

    it('should publish received data to correct EventHub channel', async () => {
        const connector = new SourceConnector(eventHub, transport, channelName);
        const publishSpy = jest.spyOn(eventHub, 'publish');

        await connector.connect();
        await transport.exposeBroadcast('test-data');

        expect(publishSpy).toHaveBeenCalledWith(channelName, 'test-data');
    });

    it('should be idempotent (remove old handler before adding new on re-connect)', async () => {
        const connector = new SourceConnector(eventHub, transport, channelName);
        const removeListenerSpy = jest.spyOn(transport, 'removeListener');
        const addListenerSpy = jest.spyOn(transport, 'addListener');

        await connector.connect();
        await connector.connect();

        expect(removeListenerSpy).toHaveBeenCalledTimes(1);
        expect(addListenerSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle disconnect when not connected', async () => {
        const connector = new SourceConnector(eventHub, transport, channelName);
        await expect(connector.disconnect()).resolves.toBeUndefined();
    });
});

// --- SinkConnector Tests (T010) ---

describe('SinkConnector', () => {
    let eventHub: EventHub;
    let transport: MockSinkTransport;
    const channelName = 'test-channel';

    beforeEach(() => {
        eventHub = new EventHub();
        transport = new MockSinkTransport();
    });

    it('should be instantiable directly (not abstract)', () => {
        const connector = new SinkConnector(eventHub, transport, channelName);
        expect(connector).toBeInstanceOf(SinkConnector);
    });

    it('should initialize with correct properties', () => {
        const connector = new SinkConnector(eventHub, transport, channelName);
        expect(connector.eventHub).toBe(eventHub);
        expect(connector.transport).toBe(transport);
        expect(connector.channel).toBe(channelName);
    });

    it('should subscribe to EventHub channel on connect', async () => {
        const connector = new SinkConnector(eventHub, transport, channelName);
        const subscribeSpy = jest.spyOn(eventHub, 'subscribe');

        await connector.connect();

        expect(subscribeSpy).toHaveBeenCalledWith(channelName, expect.any(Function));
    });

    it('should establish transport connection if not already connected', async () => {
        const connector = new SinkConnector(eventHub, transport, channelName);
        const connectSpy = jest.spyOn(transport, 'connect');

        await connector.connect();

        expect(connectSpy).toHaveBeenCalledTimes(1);
        expect(transport.isConnected()).toBe(true);
    });

    it('should unsubscribe from EventHub but NOT disconnect transport', async () => {
        const connector = new SinkConnector(eventHub, transport, channelName);

        await connector.connect();
        const disconnectSpy = jest.spyOn(transport, 'disconnect');

        await connector.disconnect();

        expect(disconnectSpy).not.toHaveBeenCalled();
        expect(transport.isConnected()).toBe(true);
    });

    it('should forward EventHub events to transport via send', async () => {
        const connector = new SinkConnector(eventHub, transport, channelName);

        await connector.connect();
        await eventHub.publish(channelName, 'test-data');

        expect(transport.sentMessages).toContain('test-data');
    });

    it('should handle disconnect when not subscribed', async () => {
        const connector = new SinkConnector(eventHub, transport, channelName);
        await expect(connector.disconnect()).resolves.toBeUndefined();
    });
});

// --- Multi-Connector Integration Test (T011) ---

describe('Multi-Connector Integration', () => {
    it('should route data from one transport to different EventHub channels', async () => {
        const eventHub = new EventHub();
        const transport = new MockSourceTransport('shared-transport');

        const connector1 = new SourceConnector(eventHub, transport, 'channel-a');
        const connector2 = new SourceConnector(eventHub, transport, 'channel-b');

        const channelAData: string[] = [];
        const channelBData: string[] = [];

        eventHub.subscribe('channel-a', (data: string) => { channelAData.push(data); });
        eventHub.subscribe('channel-b', (data: string) => { channelBData.push(data); });

        await connector1.connect();
        await connector2.connect();

        await transport.exposeBroadcast('shared-data');

        expect(channelAData).toEqual(['shared-data']);
        expect(channelBData).toEqual(['shared-data']);
    });

    it('should allow independent connector disconnect without affecting others', async () => {
        const eventHub = new EventHub();
        const transport = new MockSourceTransport('shared-transport');

        const connector1 = new SourceConnector(eventHub, transport, 'channel-a');
        const connector2 = new SourceConnector(eventHub, transport, 'channel-b');

        const channelAData: string[] = [];
        const channelBData: string[] = [];

        eventHub.subscribe('channel-a', (data: string) => { channelAData.push(data); });
        eventHub.subscribe('channel-b', (data: string) => { channelBData.push(data); });

        await connector1.connect();
        await connector2.connect();

        await connector1.disconnect();

        await transport.exposeBroadcast('after-disconnect');

        expect(channelAData).toEqual([]);
        expect(channelBData).toEqual(['after-disconnect']);
        expect(transport.isConnected()).toBe(true);
    });
});

// --- US2: SourceConnector Pipeline Tests (T017) ---

describe('SourceConnector with Pipeline', () => {
    let eventHub: EventHub;
    let transport: MockSourceTransport;
    const channelName = 'test-channel';

    beforeEach(() => {
        eventHub = new EventHub();
        transport = new MockSourceTransport('test-source');
    });

    it('should return this for chaining from use()', () => {
        const connector = new SourceConnector<string, number>(eventHub, transport, channelName);
        const pipeline = new Pipeline<string>()
            .add<number>({
                async process(data: string): Promise<PipelineResult<number>> {
                    return { success: true, data: parseInt(data) };
                },
            });

        const result = connector.use(pipeline);
        expect(result).toBe(connector);
    });

    it('should apply pipeline to data before publishing to EventHub', async () => {
        const connector = new SourceConnector<string, number>(eventHub, transport, channelName);
        const pipeline = new Pipeline<string>()
            .add<number>({
                async process(data: string): Promise<PipelineResult<number>> {
                    return { success: true, data: parseInt(data) };
                },
            });

        connector.use(pipeline);
        await connector.connect();

        const received: any[] = [];
        eventHub.subscribe(channelName, (data) => { received.push(data); });

        await transport.exposeBroadcast('42');

        expect(received).toEqual([42]);
    });

    it('should publish raw data unchanged when no pipeline is configured', async () => {
        const connector = new SourceConnector(eventHub, transport, channelName);

        await connector.connect();

        const received: any[] = [];
        eventHub.subscribe(channelName, (data) => { received.push(data); });

        await transport.exposeBroadcast('raw-data');

        expect(received).toEqual(['raw-data']);
    });

    it('should produce different outputs from two connectors with different pipelines on same transport', async () => {
        const doubleConnector = new SourceConnector<string, number>(eventHub, transport, 'doubled');
        const triplePipeline = new Pipeline<string>()
            .add<number>({
                async process(data: string): Promise<PipelineResult<number>> {
                    return { success: true, data: parseInt(data) * 2 };
                },
            });
        doubleConnector.use(triplePipeline);

        const tripleConnector = new SourceConnector<string, number>(eventHub, transport, 'tripled');
        const tripleP = new Pipeline<string>()
            .add<number>({
                async process(data: string): Promise<PipelineResult<number>> {
                    return { success: true, data: parseInt(data) * 3 };
                },
            });
        tripleConnector.use(tripleP);

        const doubled: number[] = [];
        const tripled: number[] = [];

        eventHub.subscribe('doubled', (data: number) => { doubled.push(data); });
        eventHub.subscribe('tripled', (data: number) => { tripled.push(data); });

        await doubleConnector.connect();
        await tripleConnector.connect();

        await transport.exposeBroadcast('10');

        expect(doubled).toEqual([20]);
        expect(tripled).toEqual([30]);
    });
});

// --- US2: SinkConnector Pipeline Tests (T018) ---

describe('SinkConnector with Pipeline', () => {
    let eventHub: EventHub;
    let transport: MockSinkTransport;
    const channelName = 'test-channel';

    beforeEach(() => {
        eventHub = new EventHub();
        transport = new MockSinkTransport();
    });

    it('should return this for chaining from use()', () => {
        const connector = new SinkConnector<number, string>(eventHub, transport, channelName);
        const pipeline = new Pipeline<number>()
            .add<string>({
                async process(data: number): Promise<PipelineResult<string>> {
                    return { success: true, data: String(data) };
                },
            });

        const result = connector.use(pipeline);
        expect(result).toBe(connector);
    });

    it('should apply pipeline to data received from EventHub before sending to transport', async () => {
        const connector = new SinkConnector<number, string>(eventHub, transport, channelName);
        const pipeline = new Pipeline<number>()
            .add<string>({
                async process(data: number): Promise<PipelineResult<string>> {
                    return { success: true, data: `num:${data}` };
                },
            });

        connector.use(pipeline);
        await connector.connect();

        await eventHub.publish(channelName, 42);

        expect(transport.sentMessages).toEqual(['num:42']);
    });

    it('should send raw data unchanged when no pipeline is configured', async () => {
        const connector = new SinkConnector(eventHub, transport, channelName);

        await connector.connect();
        await eventHub.publish(channelName, 'raw-data');

        expect(transport.sentMessages).toEqual(['raw-data']);
    });
});

// --- US2: Pipeline Error Handling Tests (T019) ---

describe('Pipeline Error Handling in Connectors', () => {
    let eventHub: EventHub;

    beforeEach(() => {
        eventHub = new EventHub();
    });

    it('should silently drop data when SourceConnector pipeline returns success: false', async () => {
        const transport = new MockSourceTransport('test');
        const connector = new SourceConnector<string, string>(eventHub, transport, 'channel');
        const pipeline = new Pipeline<string>()
            .add<string>({
                async process(): Promise<PipelineResult<string>> {
                    return { success: false, error: new Error('filter out') };
                },
            });

        connector.use(pipeline);
        await connector.connect();

        const received: any[] = [];
        eventHub.subscribe('channel', (data) => { received.push(data); });

        await transport.exposeBroadcast('should-be-dropped');

        expect(received).toEqual([]);
    });

    it('should silently drop data when SourceConnector pipeline returns success: true with undefined data', async () => {
        const transport = new MockSourceTransport('test');
        const connector = new SourceConnector<string, string>(eventHub, transport, 'channel');
        const pipeline = new Pipeline<string>()
            .add<string>({
                async process(): Promise<PipelineResult<string>> {
                    return { success: true, data: undefined };
                },
            });

        connector.use(pipeline);
        await connector.connect();

        const received: any[] = [];
        eventHub.subscribe('channel', (data) => { received.push(data); });

        await transport.exposeBroadcast('should-be-dropped');

        expect(received).toEqual([]);
    });

    it('should catch pipeline exception in SourceConnector without propagating', async () => {
        const transport = new MockSourceTransport('test');
        const connector = new SourceConnector<string, string>(eventHub, transport, 'channel');
        const pipeline = new Pipeline<string>()
            .add<string>({
                async process(): Promise<PipelineResult<string>> {
                    throw new Error('pipeline explosion');
                },
            });

        connector.use(pipeline);
        await connector.connect();

        const received: any[] = [];
        eventHub.subscribe('channel', (data) => { received.push(data); });

        // Should not throw
        await transport.exposeBroadcast('data');

        expect(received).toEqual([]);
    });

    it('should silently drop data when SinkConnector pipeline returns success: false', async () => {
        const transport = new MockSinkTransport();
        const connector = new SinkConnector<string, string>(eventHub, transport, 'channel');
        const pipeline = new Pipeline<string>()
            .add<string>({
                async process(): Promise<PipelineResult<string>> {
                    return { success: false, error: new Error('filter out') };
                },
            });

        connector.use(pipeline);
        await connector.connect();

        await eventHub.publish('channel', 'should-be-dropped');

        expect(transport.sentMessages).toEqual([]);
    });

    it('should catch pipeline exception in SinkConnector without propagating', async () => {
        const transport = new MockSinkTransport();
        const connector = new SinkConnector<string, string>(eventHub, transport, 'channel');
        const pipeline = new Pipeline<string>()
            .add<string>({
                async process(): Promise<PipelineResult<string>> {
                    throw new Error('pipeline explosion');
                },
            });

        connector.use(pipeline);
        await connector.connect();

        // Should not throw
        await eventHub.publish('channel', 'data');

        expect(transport.sentMessages).toEqual([]);
    });
});
