import { Channel } from "./index";

describe('[Channel] ', () => {
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

describe('[Channel]', () => {
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

  it('Should call each callback when an event is published', () => {
    channel.publish(true);
    expect(eventData).toBeTruthy();
  });

  it('Should return the last event when called', () => {
    channel.publish(true);
    expect(channel.lastEvent).toBeTruthy();
  });

  it('Should remove the subscriber when I call unsubscribe', () => {
    subscription.unsubscribe();
    expect(Object.keys(channel.callbacks).length).toBe(0);
  });

  it('Should replay the last event when I subscribe with replay active', () => {
    channel.publish(true);
    eventData = false;
    channel.subscribe((data:boolean) => {
      eventData = data;
    }, { replay: true });
    expect(eventData).toBeTruthy();
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

  it('Should catch and log error when callback throws', () => {
    const errorMessage = 'Test error in callback';
    const failingCallback = () => {
      throw new Error(errorMessage);
    };

    // Subscribe with the failing callback
    channel.subscribe(failingCallback);

    // Publish an event to trigger the callback
    channel.publish('test message');

    // Verify console.error was called with the expected error message
    expect(mockConsoleError).toHaveBeenCalled();
    expect(mockConsoleError.mock.calls[0][0]).toBe(`Error processing callback [1]`);
    expect(mockConsoleError.mock.calls[0][1]).toBeInstanceOf(Error);
  });

  it('Should continue executing other callbacks when one fails', () => {
    const successCallback = jest.fn();
    const failingCallback = () => {
      throw new Error('Test error');
    };

    // Subscribe both callbacks
    channel.subscribe(failingCallback);
    channel.subscribe(successCallback);

    // Publish an event
    channel.publish('test message');

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
  })
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

  it('Should increment publishCount when publishing events', () => {
    channel.publish('test1');
    expect(channel.metrics.publishCount).toBe(1);

    channel.publish('test2');
    expect(channel.metrics.publishCount).toBe(2);
  });

  it('Should update lastPublishTime when publishing events', () => {
    channel.publish('test');
    expect(channel.metrics.lastPublishTime).toBe(mockDate);
  });

  it('Should increment errorCount when callbacks throw errors', () => {
    const errorCallback = () => {
      throw new Error('Test error');
    };

    // Suppress console.error for this test
    jest.spyOn(console, 'error').mockImplementation(() => {});

    channel.subscribe(errorCallback);
    channel.publish('test');

    expect(channel.metrics.errorCount).toBe(1);

    // Multiple errors should increment counter multiple times
    channel.publish('test again');
    expect(channel.metrics.errorCount).toBe(2);
  });
});
