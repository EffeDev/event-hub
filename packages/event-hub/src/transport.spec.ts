import { BaseTransport, MessageHandler, SinkTransport, SourceTransport } from './transport';

// --- Mock implementations ---

class TestBaseTransport extends BaseTransport<string> {
    async connect(): Promise<void> {
        this._connected = true;
    }

    async disconnect(): Promise<void> {
        this._connected = false;
    }

    public exposeListeners(): Set<MessageHandler<string>> {
        return this.listeners;
    }
}

class TestSourceTransport extends SourceTransport<string> {
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

class TestSinkTransport extends SinkTransport<string> {
    public sentMessages: string[] = [];

    async connect(): Promise<void> {
        this._connected = true;
    }

    async disconnect(): Promise<void> {
        this._connected = false;
    }

    protected async sendMessage(data: string): Promise<void> {
        this.sentMessages.push(data);
    }
}

// --- BaseTransport Tests (T003, T004) ---

describe('BaseTransport', () => {
    let transport: TestBaseTransport;

    beforeEach(() => {
        transport = new TestBaseTransport('test-transport');
    });

    it('should initialize with correct name', () => {
        expect(transport.name).toBe('test-transport');
    });

    it('should initialize as disconnected', () => {
        expect(transport.isConnected()).toBe(false);
    });

    it('should connect successfully', async () => {
        await transport.connect();
        expect(transport.isConnected()).toBe(true);
    });

    it('should disconnect successfully', async () => {
        await transport.connect();
        await transport.disconnect();
        expect(transport.isConnected()).toBe(false);
    });

    it('should throw error when checking connection status if not connected', () => {
        expect(() => transport.checkConnected()).toThrow('Transport not connected');
    });

    it('should not throw error when checking connection status if connected', async () => {
        await transport.connect();
        expect(() => transport.checkConnected()).not.toThrow();
    });

    // T003: Listener management tests
    it('should have initially empty listeners set', () => {
        expect(transport.exposeListeners().size).toBe(0);
    });

    it('should add listener to set', () => {
        const handler: MessageHandler<string> = async () => {};
        transport.addListener(handler);
        expect(transport.exposeListeners().has(handler)).toBe(true);
        expect(transport.exposeListeners().size).toBe(1);
    });

    it('should remove listener by reference', () => {
        const handler: MessageHandler<string> = async () => {};
        transport.addListener(handler);
        transport.removeListener(handler);
        expect(transport.exposeListeners().has(handler)).toBe(false);
        expect(transport.exposeListeners().size).toBe(0);
    });

    it('should be no-op when adding same handler twice (Set semantics)', () => {
        const handler: MessageHandler<string> = async () => {};
        transport.addListener(handler);
        transport.addListener(handler);
        expect(transport.exposeListeners().size).toBe(1);
    });

    it('should be no-op when removing non-existent handler', () => {
        const handler: MessageHandler<string> = async () => {};
        expect(() => transport.removeListener(handler)).not.toThrow();
        expect(transport.exposeListeners().size).toBe(0);
    });

    // T004: Verify usePipeline does not exist
    it('should not expose usePipeline method', () => {
        expect((transport as any).usePipeline).toBeUndefined();
    });

    it('should not have pipeline property', () => {
        expect((transport as any).pipeline).toBeUndefined();
    });
});

// --- SourceTransport Tests (T007) ---

describe('SourceTransport', () => {
    let transport: TestSourceTransport;

    beforeEach(() => {
        transport = new TestSourceTransport('test-source');
    });

    it('should broadcast to all listeners', async () => {
        await transport.connect();
        const results: string[] = [];
        const handler1: MessageHandler<string> = async (data) => { results.push(`h1:${data}`); };
        const handler2: MessageHandler<string> = async (data) => { results.push(`h2:${data}`); };

        transport.addListener(handler1);
        transport.addListener(handler2);

        await transport.exposeBroadcast('test-data');

        expect(results).toContain('h1:test-data');
        expect(results).toContain('h2:test-data');
        expect(results).toHaveLength(2);
    });

    it('should be no-op when broadcasting with no listeners', async () => {
        await transport.connect();
        await expect(transport.exposeBroadcast('test-data')).resolves.toBeUndefined();
    });

    it('should isolate listener errors (one throwing does not prevent others)', async () => {
        await transport.connect();
        const results: string[] = [];
        const throwingHandler: MessageHandler<string> = async () => { throw new Error('handler error'); };
        const successHandler: MessageHandler<string> = async (data) => { results.push(data); };

        transport.addListener(throwingHandler);
        transport.addListener(successHandler);

        await transport.exposeBroadcast('test-data');

        expect(results).toContain('test-data');
    });
});

// --- SinkTransport Tests (T008) ---

describe('SinkTransport', () => {
    let transport: TestSinkTransport;

    beforeEach(() => {
        transport = new TestSinkTransport('test-sink');
    });

    it('should throw error when sending message without being connected', async () => {
        await expect(transport.send('test')).rejects.toThrow('Transport not connected');
    });

    it('should send message directly without pipeline processing', async () => {
        await transport.connect();
        await transport.send('hello');
        expect(transport.sentMessages).toEqual(['hello']);
    });

    it('should not have usePipeline method', () => {
        expect((transport as any).usePipeline).toBeUndefined();
    });

    it('should handle errors when sending message', async () => {
        await transport.connect();

        const originalSendMessage = transport['sendMessage'];
        transport['sendMessage'] = jest.fn().mockImplementationOnce(() => {
            throw new Error('Send error');
        });

        await expect(transport.send('test')).rejects.toThrow('Send error');

        transport['sendMessage'] = originalSendMessage;
    });
});

// --- US4 Verification: Minimal Transport API (T027) ---

describe('MinimalTestTransport (US4 Verification)', () => {
    class MinimalTestTransport extends SourceTransport<string> {
        async connect(): Promise<void> {
            this._connected = true;
        }

        async disconnect(): Promise<void> {
            this._connected = false;
        }

        public simulateData(data: string): Promise<void> {
            return this.broadcast(data);
        }
    }

    it('should work with only connect, disconnect, and broadcast', async () => {
        const transport = new MinimalTestTransport('minimal');
        const results: string[] = [];

        transport.addListener(async (data) => { results.push(data); });
        await transport.connect();
        await transport.simulateData('hello');

        expect(results).toEqual(['hello']);
    });

    it('should not require pipeline or routing knowledge', () => {
        const transport = new MinimalTestTransport('minimal');
        expect((transport as any).pipeline).toBeUndefined();
        expect((transport as any).usePipeline).toBeUndefined();
    });
});
