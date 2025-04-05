import { EventHub } from './index';
import { WildCardChannel } from './types';

describe('[EventHub]: subscribe', () => {
  let eventHub: EventHub;
  let eventData: boolean;
  let publishCount: number;

  beforeEach(() => {
    eventHub = new EventHub();
    eventData = false;
    publishCount = 0;
  });

  it('Should add a channel when I subscribe', () => {
    eventHub.subscribe<boolean>('test', (data:boolean) => {
      eventData = data;
      publishCount++;
    });
    // need to take into account the WildCardChannel
    expect(eventHub.channelCount).toBe(2);
  });

  it('Should not add another channel when I subscribe to the same channel',
    () => {
      eventHub.subscribe<boolean>('test', (data:boolean) => {
        eventData = data;
      });
      eventHub.subscribe<boolean>('test', (data:boolean) => {
        eventData = data;
      });
      expect(eventHub.channelCount).toBe(2);
    });

  it('Should add another channel when I subscribe to a unique name', () => {
    eventHub.subscribe<boolean>('test', (data:boolean) => {
      eventData = data;
    });
    eventHub.subscribe<boolean>('another', (data: boolean) => {
      eventData = data;
      publishCount++;
    });
    expect(eventHub.channelCount).toBe(3);
  });

  it('Should call the callback when I publish an event', () => {
    eventHub.subscribe<boolean>('test', (data:boolean) => {
      eventData = data;
      publishCount++;
    });
    eventHub.publish<boolean>('test', true);
    expect(eventData).toBeTruthy();
    expect(publishCount).toBe(1);
  });

  it('should return 0 when checking callback count for an invalid channel', () => {
    expect(eventHub.callbackCount('invalid')).toBe(0);
  });

  it('Should return Subscription from the channel. Unsubscribing will not remove the EventHub channel', () => {
    let eventData: string = '';
    const sub = eventHub.subscribe<string>('tester', (data:string) => {
      eventData = data;
    });

    eventHub.publish<string>('tester', 'this is a test');
    expect(eventData).toBe('this is a test');
    expect(sub).toHaveProperty('unsubscribe');

    const channelCount = eventHub.channelCount;
    sub.unsubscribe();
    expect(eventHub.channelCount).toBe(channelCount);
  });

  it('Should remove e callback function from the channel callback list when unsubscribing', () => {
    let eventData: string = '';
    const sub = eventHub.subscribe<string>('tester', (data:string) => {
      eventData = data;
    });

    eventHub.publish<string>('tester', 'this is a test');
    expect(eventData).toBe('this is a test');
    expect(sub).toHaveProperty('unsubscribe');

    const callbackCount = eventHub.callbackCount('tester');
    sub.unsubscribe();
    expect(eventHub.callbackCount('tester')).toBe(callbackCount - 1);
  });

  it('Should throw exception when channel is empty', () => {
    const test = () => {
      eventHub.subscribe<boolean>('', (data: boolean) => {
        eventData = data;
      });
    }
    expect(test).toThrow('Channel name must be a non-empty string');
    expect(test).toThrow(TypeError);
  })

});

describe('[EventHub]: Group unsubscribe', () => {
  let eventHub: EventHub;

  beforeEach(() => {
    eventHub = new EventHub();
  });

  it('Should unsubscribe all callbacks from all channels in a group', () => {
    let eventData1: string = '';
    let eventData2: string = '';
    const sub1 = eventHub.subscribe<string>('tester', (data:string) => {
      eventData1 = data;
    }, { group: 'test-group'});

    const sub2 = eventHub.subscribe<string>('tester-2', (data:string) => {
      eventData2 = data;
    }, { group: 'test-group'});

    eventHub.publish<string>('tester', 'this is a test');
    expect(eventData1).toBe('this is a test');
    eventHub.publish<string>('tester-2', 'this is a test');
    expect(eventData2).toBe('this is a test');
    expect(sub1).toHaveProperty('unsubscribe');
    expect(sub2).toHaveProperty('unsubscribe');

    eventHub.unsubscribeGroup('test-group');
    
    // Reset test data
    eventData1 = '';
    eventData2 = '';
    
    // Publish again to verify callbacks are unsubscribed
    eventHub.publish<string>('tester', 'after unsubscribe');
    eventHub.publish<string>('tester-2', 'after unsubscribe');
    expect(eventData1).toBe('');
    expect(eventData2).toBe('');
  });

  it('Should handle unsubscribe for non-existent group', () => {
    // Should not throw any errors
    eventHub.unsubscribeGroup('non-existent-group');
  });

  it('Should not affect other groups when unsubscribing one group', () => {
    let data1 = '', data2 = '';
    eventHub.subscribe<string>('channel1', (data) => { data1 = data; }, { group: 'group1' });
    eventHub.subscribe<string>('channel1', (data) => { data2 = data; }, { group: 'group2' });

    eventHub.unsubscribeGroup('group1');
    eventHub.publish<string>('channel1', 'test');

    expect(data1).toBe(''); // group1 was unsubscribed
    expect(data2).toBe('test'); // group2 should still receive events
  });

  it('Should handle replay option with group subscriptions', () => {
    eventHub.publish<string>('test-channel', 'initial');

    let data1 = '', data2 = '';
    eventHub.subscribe<string>('test-channel', (data) => { data1 = data; }, { group: 'group1', replay: true });
    eventHub.subscribe<string>('test-channel', (data) => { data2 = data; }, { group: 'group1', replay: true });

    expect(data1).toBe('initial');
    expect(data2).toBe('initial');
  });
});

describe('[EventHub]: Wildcard Subscribe', () => {
  let eventHub: EventHub;
  let eventData: string;

  beforeEach(() => {
    eventHub = new EventHub();
    eventData = '';
  });

  it('Should add my callback to the channel when I subscribe', () => {
    eventHub.subscribe<string>('*', (data:string) => {
      eventData = data;
    });
    expect(eventHub.channelCount).toBe(1);
    expect(eventHub.callbackCount(WildCardChannel)).toBe(1);
  });

  it('Should call the callback when I publish an event', () => {
    eventHub.subscribe<string>('*', (data: string) => {
      eventData = data;
    });
    eventHub.publish<string>('test', 'this is a test');
    expect(eventData).toBe('this is a test');
  });

  it('Should call the callback when I publish an event no matter the channel published to', () => {
    eventHub.subscribe<string>('*', (data: string) => {
      eventData = data;
    });
    eventHub.publish<string>('another', 'this is another test');
    expect(eventData).toBe('this is another test');
  });
});

describe('[EventHub]: publish', () => {
  let eventHub: EventHub;

  beforeEach(() => {
    eventHub = new EventHub();
  });

  it('Should add a channel when I publish to a new channel', () => {
    eventHub.publish<string>('new channel', 'created it!');
    expect(eventHub.lastEvent<string>('new channel')).toBe('created it!');
    expect(eventHub.channelCount).toBe(2);
    eventHub.publish<boolean>('another channel', true);
    expect(eventHub.channelCount).toBe(3);
    expect(eventHub.lastEvent<boolean>('another channel')).toBeTruthy();
  });

  it('Should add a channel when I check for the last event', () => {
    const lastEvent = eventHub.lastEvent<Record<string, any>>('newest channel');
    expect(lastEvent).toBeUndefined();
    expect(eventHub.channelCount).toBe(2);
  });
});

