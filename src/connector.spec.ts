import { EventHub } from './event-hub';
import { SourceConnector, SinkConnector } from './connector';
import { SourceTransport, SinkTransport } from './transport';
import { Subscription } from './types';

// Mock implementations for testing
class MockSourceTransport extends SourceTransport<string, object> {
  public disconnectCalled = false;

  async connect(): Promise<void> {
    this._connected = true;
  }

  async disconnect(): Promise<void> {
    this._connected = false;
    this.disconnectCalled = true;
  }

  // Method to simulate receiving data from external source
  async simulateReceiveData(data: object): Promise<void> {
    if (this._onDataHandler) {
      await this._onDataHandler(data);
    }
  }
}

class MockSinkTransport extends SinkTransport<object, string> {
  public sentMessages: any[] = [];
  public disconnectCalled = false;

  async connect(): Promise<void> {
    this._connected = true;
  }

  async disconnect(): Promise<void> {
    this._connected = false;
    this.disconnectCalled = true;
  }

  protected async sendMessage(data: string): Promise<void> {
    this.sentMessages.push(data);
  }
}

// Concrete implementations for testing
class TestSourceConnector extends SourceConnector<string, object> {
  constructor(eventHub: EventHub, transport: MockSourceTransport, channel: string) {
    super(eventHub, transport, channel);
  }

  // Expose protected properties for testing
  getChannel(): string {
    return this.channel;
  }
}

class TestSinkConnector extends SinkConnector<object, string> {
  constructor(eventHub: EventHub, transport: MockSinkTransport, channel: string) {
    super(eventHub, transport, channel);
  }

  // Expose protected properties for testing
  getSubscription(): Subscription | undefined {
    return this.subscription;
  }
}

describe('SourceConnector', () => {
  let eventHub: EventHub;
  let transport: MockSourceTransport;
  let connector: TestSourceConnector;
  const channelName = 'test-channel';
  
  beforeEach(() => {
    eventHub = new EventHub();
    transport = new MockSourceTransport('test-source-transport');
    connector = new TestSourceConnector(eventHub, transport, channelName);
  });

  it('should initialize with correct properties', () => {
    expect(connector.eventHub).toBe(eventHub);
    expect(connector.transport).toBe(transport);
    expect(connector.getChannel()).toBe(channelName);
  });

  it('should connect to transport and register data handler', async () => {
    await connector.connect();
    expect(transport.isConnected()).toBe(true);
  });

  it('should publish received data to EventHub', async () => {
    const publishSpy = jest.spyOn(eventHub, 'publish');
    const testData = { message: 'test data' };
    
    await connector.connect();
    await transport.simulateReceiveData(testData);
    
    expect(publishSpy).toHaveBeenCalledWith(channelName, testData);
  });

  it('should disconnect from transport', async () => {
    await connector.connect();
    await connector.disconnect();
    expect(transport.disconnectCalled).toBe(true);
  });
});

describe('SinkConnector', () => {
  let eventHub: EventHub;
  let transport: MockSinkTransport;
  let connector: TestSinkConnector;
  const channelName = 'test-channel';
  
  beforeEach(() => {
    eventHub = new EventHub();
    transport = new MockSinkTransport('test-sink-transport');
    connector = new TestSinkConnector(eventHub, transport, channelName);
  });

  it('should initialize with correct properties', () => {
    expect(connector.eventHub).toBe(eventHub);
    expect(connector.transport).toBe(transport);
    expect(connector.channel).toBe(channelName);
  });

  it('should connect to transport and subscribe to EventHub channel', async () => {
    await connector.connect();
    expect(transport.isConnected()).toBe(true);
    expect(connector.getSubscription()).toBeDefined();
  });

  it('should send data to transport when event is published', async () => {
    const testData = { message: 'test data' };
    
    await connector.connect();
    await eventHub.publish(channelName, testData);
    
    // Since the transport is mocked, we need to check if the send method was called
    expect(transport.sentMessages.length).toBeGreaterThan(0);
  });

  it('should unsubscribe from EventHub and disconnect transport', async () => {
    await connector.connect();
    const subscription = connector.getSubscription();
    const unsubscribeSpy = jest.spyOn(subscription!, 'unsubscribe');
    
    await connector.disconnect();
    
    expect(unsubscribeSpy).toHaveBeenCalled();
    expect(transport.disconnectCalled).toBe(true);
  });

  it('should handle disconnect when not subscribed', async () => {
    // Don't connect first
    await connector.disconnect();
    expect(transport.disconnectCalled).toBe(true);
  });
});

describe('Integration between Connectors', () => {
  let eventHub: EventHub;
  let sourceTransport: MockSourceTransport;
  let sinkTransport: MockSinkTransport;
  let sourceConnector: TestSourceConnector;
  let sinkConnector: TestSinkConnector;
  const channelName = 'test-channel';
  
  beforeEach(() => {
    eventHub = new EventHub();
    sourceTransport = new MockSourceTransport('test-source-transport');
    sinkTransport = new MockSinkTransport('test-sink-transport');
    sourceConnector = new TestSourceConnector(eventHub, sourceTransport, channelName);
    sinkConnector = new TestSinkConnector(eventHub, sinkTransport, channelName);
  });

  it('should form a complete data flow from source to sink', async () => {
    const testData = { message: 'test data' };
    
    // Connect both connectors
    await sourceConnector.connect();
    await sinkConnector.connect();
    
    // Simulate data coming from external source
    await sourceTransport.simulateReceiveData(testData);
    
    // Verify data was sent to the sink transport
    expect(sinkTransport.sentMessages.length).toBeGreaterThan(0);
  });
});
