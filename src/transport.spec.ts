import { BaseTransport, SourceTransport, SinkTransport } from './transport';
import { Pipeline, PipelineResult } from './pipeline';

// Mock implementations for testing
class TestBaseTransport extends BaseTransport<string> {
    async connect(): Promise<void> {
        this._connected = true;
    }

    async disconnect(): Promise<void> {
        this._connected = false;
    }

    // Expose protected properties for testing
    public exposePipeline() {
        return this.pipeline;
    }
}

class TestSourceTransport extends SourceTransport<string, number> {
    async connect(): Promise<void> {
        this._connected = true;
    }

    async disconnect(): Promise<void> {
        this._connected = false;
    }

    // Expose protected properties for testing
    public exposeMessageHandler() {
        return this._onDataHandler;
    }
}

class TestSinkTransport extends SinkTransport<string, number> {
    public sentMessages: number[] = [];

    async connect(): Promise<void> {
        this._connected = true;
    }

    async disconnect(): Promise<void> {
        this._connected = false;
    }

    protected async sendMessage(data: number): Promise<void> {
        this.sentMessages.push(data);
    }
}

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

    it('should set pipeline correctly', () => {
        const pipeline = new Pipeline<string>();
        transport.usePipeline(pipeline);
        expect(transport.exposePipeline()).toBe(pipeline);
    });
});

describe('SourceTransport', () => {
    let transport: TestSourceTransport;
    let mockHandler: jest.Mock;

    beforeEach(() => {
        transport = new TestSourceTransport('test-source');
        mockHandler = jest.fn();
    });

    it('should initialize without message handler', () => {
        expect(transport.exposeMessageHandler()).toBeUndefined();
    });

    it('should set message handler correctly', () => {
        transport.onData(mockHandler);
        expect(transport.exposeMessageHandler()).toBe(mockHandler);
    });

    it('should throw error when handling message without being connected', async () => {
        transport.onData(mockHandler);
        await expect(transport.messageHandler('test')).rejects.toThrow('Transport not connected');
    });

    it('should throw error when handling message without handler', async () => {
        await transport.connect();
        await expect(transport.messageHandler('test')).rejects.toThrow('No message handler defined');
    });

    it('should handle message without pipeline', async () => {
        await transport.connect();
        transport.onData(mockHandler);
        await transport.messageHandler('123' as any); // Type assertion needed due to string -> number conversion
        expect(mockHandler).toHaveBeenCalledWith('123');
    });

    it('should handle message with successful pipeline', async () => {
        await transport.connect();
        transport.onData(mockHandler);
        
        const pipeline = new Pipeline<string>()
        .add<number>({
            async process(data: string): Promise<PipelineResult<number>> {
                return { success: true, data: parseInt(data) };
            }
        });
        transport.usePipeline(pipeline);

        await transport.messageHandler('123');
        expect(mockHandler).toHaveBeenCalledWith(123);
    });

    it('should handle message with pipeline returning undefined', async () => {
        await transport.connect();
        transport.onData(mockHandler);
        
        const pipeline = new Pipeline<string>()
            .add<number>({
                async process(): Promise<PipelineResult<number>> {
                    return { success: true };
                }
                }
            );
        transport.usePipeline(pipeline);

        await transport.messageHandler('123');
        expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should throw error when pipeline processing fails', async () => {
        await transport.connect();
        transport.onData(mockHandler);
        
        const testError = new Error('Pipeline error');
        const pipeline = new Pipeline<string>()
            .add<number>({
                async process(): Promise<PipelineResult<number>> {
                    return { success: false, error: testError };
                }
                }
            );
        transport.usePipeline(pipeline);

        await expect(transport.messageHandler('123')).rejects.toThrow('Pipeline error');
        expect(mockHandler).not.toHaveBeenCalled();
    });
});

describe('SinkTransport', () => {
    let transport: TestSinkTransport;

    beforeEach(() => {
        transport = new TestSinkTransport('test-sink');
    });

    it('should throw error when sending message without being connected', async () => {
        await expect(transport.send('test')).rejects.toThrow('Transport not connected');
    });

    it('should send message without pipeline', async () => {
        await transport.connect();
        // Create a pipeline to handle the string to number conversion
        const pipeline = new Pipeline<string>()
            .add<number>({
                async process(data: string): Promise<PipelineResult<number>> {
                    return { success: true, data: parseInt(data) };
                }
            });
        transport.usePipeline(pipeline);
        await transport.send('123');
        expect(transport.sentMessages).toContain(123);
    });

    it('should send message with successful pipeline', async () => {
        await transport.connect();
        
        const pipeline = new Pipeline<string>()
            .add<number>({
                async process(data: string): Promise<PipelineResult<number>> {
                    return { success: true, data: parseInt(data) };
                }
                }
            );
        transport.usePipeline(pipeline);

        await transport.send('123');
        expect(transport.sentMessages).toContain(123);
    });

    it('should not send message when pipeline returns undefined', async () => {
        await transport.connect();
        
        const pipeline = new Pipeline<string>()
            .add<number>({
                async process(): Promise<PipelineResult<number>> {
                    return { success: true }; // No data property, should be treated as undefined
                }
            });
        transport.usePipeline(pipeline);

        await transport.send('123');
        expect(transport.sentMessages).toHaveLength(0);
    });

    it('should throw error when pipeline processing fails', async () => {
        await transport.connect();
        
        const testError = new Error('Pipeline error');
        const pipeline = new Pipeline<string>()
            .add<number>({
                async process(): Promise<PipelineResult<number>> {
                    return { success: false, error: testError };
                }
                }
            );
        transport.usePipeline(pipeline);

        await expect(transport.send('123')).rejects.toThrow('Pipeline error');
        expect(transport.sentMessages).toHaveLength(0);
    });
    
    it('should handle errors when sending message without pipeline', async () => {
        await transport.connect();
        
        // Create a spy on the protected sendMessage method that throws an error
        const originalSendMessage = transport['sendMessage'];
        transport['sendMessage'] = jest.fn().mockImplementationOnce(() => {
            throw new Error('Send error');
        });
        
        await expect(transport.send('test')).rejects.toThrow('Send error');
        
        // Restore the original method
        transport['sendMessage'] = originalSendMessage;
    });
});