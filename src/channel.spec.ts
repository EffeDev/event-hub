import { Channel } from "./index";

describe('[Channel] Basic Operations', () => {
  let channel: Channel<boolean>;

  beforeEach(() => {
    channel = new Channel<boolean>('test');
  });

  it('lastEvent should be undefined when no events published', ()=> {
    expect(channel.lastEvent).toBeUndefined();
  });

  it('callbacks should be empty with no subscribers', () => {
    expect(Object.keys(channel.callbacks).length).toBe(0);
  });

  it('Should have a name property [test]', () => {
    expect(channel.name).toBe('test');
  });
});

describe('[Channel] Subscription Management', () => {
  let channel: Channel<boolean>;
  let eventData: boolean;
  let subscription: any;

  beforeEach(() => {
    channel = new Channel<boolean>('test');
    eventData = false;
    subscription = channel.subscribe((data: boolean) => {
      eventData = data;
    });
  });

  it('Should return 1 for the first subscriber', () => {
    expect(subscription.id).toBe(1);
  });

  it('Should call each callback when an event is published', async () => {
    await channel.publish(true);
    expect(eventData).toBeTruthy();
  });

  it('Should return the last event when called', async () => {
    await channel.publish(true);
    expect(channel.lastEvent).toBeTruthy();
  });

  it('Should remove the subscriber when I call unsubscribe', async () => {
    subscription.unsubscribe();
    expect(Object.keys(channel.callbacks).length).toBe(0);
  });

  it('Should replay the last event when I subscribe with replay active', async () => {
    await channel.publish(true);
    eventData = false;
    channel.subscribe((data:boolean) => {
      eventData = data;
    }, { replay: true });
    expect(eventData).toBeTruthy();
  });
});

describe('[Channel] Group Subscription Management', () => {
  let channel: Channel<string>;
  let receivedMessages: string[];

  beforeEach(() => {
    channel = new Channel<string>('test');
    receivedMessages = [];
  });

  it('Should add subscribers to the same group', async () => {
    const callback1 = (msg: string) => { receivedMessages.push(`cb1: ${msg}`) };
    const callback2 = (msg: string) => { receivedMessages.push(`cb2: ${msg}`) };

    channel.subscribe(callback1, { group: 'testGroup' });
    channel.subscribe(callback2, { group: 'testGroup' });

    await channel.publish('hello');
    expect(receivedMessages).toEqual(['cb1: hello', 'cb2: hello']);
  });

  it('Should unsubscribe all callbacks in a group', async () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    const callback3 = jest.fn();

    channel.subscribe(callback1, { group: 'group1' });
    channel.subscribe(callback2, { group: 'group1' });
    channel.subscribe(callback3, { group: 'group2' });

    channel.unsubscribeGroup('group1');

    await channel.publish('test');
    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).not.toHaveBeenCalled();
    expect(callback3).toHaveBeenCalledWith('test');
  });

  it('Should handle unsubscribe for non-existent group', () => {
    channel.unsubscribeGroup('nonexistent');
    // Should not throw any errors
    expect(channel.callbacks.size).toBe(0);
  });

  it('Should remove callback from group when unsubscribed individually', async () => {
    const callback = jest.fn();
    const subscription = channel.subscribe(callback, { group: 'testGroup' });
    
    subscription.unsubscribe();
    await channel.publish('test');
    
    expect(callback).not.toHaveBeenCalled();
  });

  it('Should handle multiple groups for the same channel', async () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    const callback3 = jest.fn();

    channel.subscribe(callback1, { group: 'group1' });
    channel.subscribe(callback2, { group: 'group2' });
    channel.subscribe(callback3, { group: 'group1' });

    channel.unsubscribeGroup('group1');
    await channel.publish('test');

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledWith('test');
    expect(callback3).not.toHaveBeenCalled();
  });

  it('Should handle replay option with group subscriptions', async () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();

    await channel.publish('initial');
    
    channel.subscribe(callback1, { group: 'group1', replay: true });
    channel.subscribe(callback2, { group: 'group1', replay: true });

    expect(callback1).toHaveBeenCalledWith('initial');
    expect(callback2).toHaveBeenCalledWith('initial');
  });
});

describe('[Channel] Error Handling', () => {
  let channel: Channel<string>;
  let originalConsoleError: typeof console.error;
  let mockConsoleError: jest.SpyInstance;

  beforeEach(() => {
    channel = new Channel<string>('test');
    // Store the original console.error
    originalConsoleError = console.error;
    // Create a mock for console.error
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore the original console.error
    mockConsoleError.mockRestore();
    console.error = originalConsoleError;
  });

  it('Should catch and log error when callback throws', async () => {
    const errorMessage = 'Test error in callback';
    const failingCallback = () => {
      throw new Error(errorMessage);
    };

    // Subscribe with the failing callback
    channel.subscribe(failingCallback);

    // Publish an event to trigger the callback
    await channel.publish('test message');

    // Verify console.error was called with the expected error message
    expect(mockConsoleError).toHaveBeenCalled();
    expect(mockConsoleError.mock.calls[0][0]).toBe(`Error in channel test callback:`);
    expect(mockConsoleError.mock.calls[0][1]).toBeInstanceOf(Error);
  });

  it('Should continue executing other callbacks when one fails', async () => {
    const successCallback = jest.fn();
    const failingCallback = () => {
      throw new Error('Test error');
    };

    // Subscribe both callbacks
    channel.subscribe(failingCallback);
    channel.subscribe(successCallback);

    // Publish an event
    await channel.publish('test message');

    // Verify the success callback was still called
    expect(successCallback).toHaveBeenCalledWith('test message');
    // Verify the error was logged
    expect(mockConsoleError).toHaveBeenCalled();
  });

  it('Should throw a TypeError when an invalid callback is provided', () => {
    expect(() => {
      channel.subscribe('not a function' as any);
    }).toThrow(TypeError);
    expect(() => {
      channel.subscribe('not a function' as any);
    }).toThrow('Callback must be a function');
  });

  it('Should handle async callback errors in debug mode', async () => {
    const debugChannel = new Channel<string>('test');
    const successCallback = jest.fn();
    const failingCallback = async () => {
      throw new Error('Async error');
    };

    debugChannel.subscribe(failingCallback);
    debugChannel.subscribe(successCallback);

    // This should no longer throw
    await debugChannel.publish('test message');

    // Both callbacks should have been attempted
    expect(successCallback).toHaveBeenCalledWith('test message');
    // Error should have been logged
    expect(mockConsoleError).toHaveBeenCalled();
    // Error message should match
    expect(mockConsoleError.mock.calls[0][0]).toBe('Error in channel test callback:');
  });

  it('Should directly test debug mode error handling', async () => {
    // Create a channel in debug mode
    const debugChannel = new Channel<string>('test-debug');
    
    // Create a spy on the console.error method
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Create a callback that will throw an error
    const failingCallback = async () => {
      throw new Error('Debug mode error');
    };
    
    // Subscribe the failing callback
    debugChannel.subscribe(failingCallback);
    
    // Publish to trigger the error in debug mode
    await debugChannel.publish('test message');
    
    // Verify the error was logged
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Error in channel test-debug callback:',
      expect.any(Error)
    );
    
    // Verify metrics were updated
    expect(debugChannel.metrics.errorCount).toBe(1);
    
    // Clean up
    errorSpy.mockRestore();
  });

  it('Should directly test production mode error handling', async () => {
    // Create a channel in production mode
    const prodChannel = new Channel<string>('test-prod');
    
    // Create a spy on the console.error method
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Create a callback that returns a rejected promise
    const failingCallback = () => Promise.reject(new Error('Production mode error'));
    
    // Subscribe the failing callback
    prodChannel.subscribe(failingCallback);
    
    // Publish to trigger the error in production mode
    await prodChannel.publish('test message');
    
    // Verify the error was logged
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Error in channel test-prod callback:',
      expect.any(Error)
    );
    
    // Verify metrics were updated
    expect(prodChannel.metrics.errorCount).toBe(1);
    
    // Clean up
    errorSpy.mockRestore();
  });
});

describe('[Channel] Metrics', () => {
  let channel: Channel<string>;
  let mockDate: number;

  beforeEach(() => {
    channel = new Channel<string>('test');
    mockDate = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => mockDate);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Should have initial metrics values of zero', () => {
    expect(channel.metrics.publishCount).toBe(0);
    expect(channel.metrics.errorCount).toBe(0);
    expect(channel.metrics.lastPublishTime).toBe(0);
  });

  it('Should increment publishCount when publishing events', async () => {
    await channel.publish('test1');
    expect(channel.metrics.publishCount).toBe(1);

    await channel.publish('test2');
    expect(channel.metrics.publishCount).toBe(2);
  });

  it('Should update lastPublishTime when publishing events', async () => {
    await channel.publish('test');
    expect(channel.metrics.lastPublishTime).toBe(mockDate);
  });

  it('Should increment errorCount when callbacks throw errors', async () => {
    const errorCallback = () => {
      throw new Error('Test error');
    };

    // Suppress console.error for this test
    jest.spyOn(console, 'error').mockImplementation(() => {});

    channel.subscribe(errorCallback);
    await channel.publish('test');

    expect(channel.metrics.errorCount).toBe(1);

    // Multiple errors should increment counter multiple times
    await channel.publish('test again');
    expect(channel.metrics.errorCount).toBe(2);
  });

  it('Should increment errorCount for async errors in debug mode', async () => {
    const debugChannel = new Channel<string>('test');
    const errorCallback = async () => {
      throw new Error('Async error');
    };

    // Suppress console.error for this test
    jest.spyOn(console, 'error').mockImplementation(() => {});

    debugChannel.subscribe(errorCallback);
    await debugChannel.publish('test');

    expect(debugChannel.metrics.errorCount).toBe(1);
  });
});




