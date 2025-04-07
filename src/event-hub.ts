import { Channel } from "./channel";
import { EventCallback, SubscribeOptions, Subscription, WildCardChannel } from "./types";

/**
 * Implements the EventHub which enables a simple publish/subscribe mechanism for loosely coupled event passing between
 * registered components.
 *
 * @class EventHub
 * @description
 * This class manages multiple channels for event communication. It allows components to subscribe to specific channels,
 * publish events to channels, and retrieve the last event published on a channel. The EventHub acts as a central
 * coordinator for all event-based communication within an application.
 *
 * Key features:
 * - Dynamic channel creation: Channels are created on-demand when publishing or subscribing.
 * - Type-safe events: Each channel can handle a specific event type.
 * - Last event retrieval: Ability to get the most recent event from any channel.
 * - Subscription management: Easy subscription and unsubscribe mechanism.
 *
 * @property {Record<string, Channel<any>>} _channels - Private property that stores all the channels managed by the event hub.
 * Each key is a channel name, and the value is the corresponding Channel instance.
 *
 * @method subscribe - Allows components to subscribe to a specific channel and receive events published on that channel.
 * @method publish - Allows components to publish an event to a specific channel, notifying all subscribers.
 * @method lastEvent - Retrieves the last event that was published on a specified channel.
 * @method channels - Getter that returns all channels currently managed by the EventHub.
 *
 * @example
 * const eventHub = new EventHub();
 * const subscription = eventHub.subscribe('userLogin', (user) => console.log(`${user} logged in`));
 * eventHub.publish('userLogin', 'Alice');
 * // Output: Alice logged in
 * console.log(eventHub.lastEvent('userLogin')); // Output: Alice
 * subscription.unsubscribe();
 */
export class EventHub {
  /**
   * Holds the list of channels created by publish/subscribe methods of the EventHub
   *
   * @private
   */
  private channels: Map<string, Channel<any>> = new Map();

  /**
   * Creates a new EventHub instance.
   *
   * @description
   * The constructor initializes a wildcard channel object.
   * Channels are created dynamically as they are subscribed to or published to.
   */
  constructor() {
    // Create the Wildcard Channel
    this.getOrCreateChannel<any>(WildCardChannel);
  }

  private getChannel(channel: string) : Channel<any>|undefined {
    return this.channels.get(channel);
  }

  private getOrCreateChannel<TData>(channel: string): Channel<TData> {
    if (!channel || typeof channel !== 'string') {
      throw new TypeError('Channel name must be a non-empty string');
    }
    if (!this.channels.has(channel)) {
        this.channels.set(channel, new Channel<TData>(channel));
    }
    return this.channels.get(channel) as Channel<TData>;
  }

  /**
   * Get the Channel Count for the EventHub
   * 
   * @returns the channel count (number)
   */
  get channelCount() {
    return this.channels.size;
  }

  callbackCount(channel: string) {
    const ch = this.getChannel(channel);
    if (ch) {
        return ch.callbacks.size;
    }
    return 0;
  }

  /*
   * Enable unsubscribing from an entire group of subscriptions.
   *
   * @param group 
   */
  unsubscribeGroup(group: string): void {
    // Unsubscribe group from all channels that might have it
    this.channels.forEach(channel => {
      channel.unsubscribeGroup(group);
    });
  }

  /**
   * Subscribes to all events sent on a specific channel of the event hub.
   *
   * @template TData The type of event that this subscription handles.
   * @param {string} channel - The name of the channel to subscribe to.
   * @param {EventCallback<TData>} callback - The function to be called by the EventHub for each event published on this channel.
   * @param {SubscribeOptions} [options] - Optional settings for the subscription including replay and group.
   * @returns {Subscription} An object containing the unsubscribe method and the subscription ID.
   */
  subscribe<TData>(channel: string, callback: EventCallback<TData>, options?: SubscribeOptions): Subscription {
    const ch = this.getOrCreateChannel<TData>(channel);
    return ch.subscribe(callback, options);
  }

  /**
   * Publishes an event to a specific channel on the event hub.
   *
   * @template TData The type of event being published.
   * @param {string} channel - The name of the channel to publish the event to.
   * @param {TData} data - The event data to be sent to each subscriber of the channel.
   */
  async publish<TData>(channel: string, data: TData): Promise<void> {
    const ch = this.getOrCreateChannel<TData>(channel);
    await ch.publish(data);
    
    // Also publish to wildcard channel
    if (channel !== WildCardChannel) {
        await this.getOrCreateChannel<any>(WildCardChannel).publish(data);
    }
  }

  /**
   * Retrieves the last event that was published on a specific channel.
   *
   * @template TEvent The type of event expected from this channel.
   * @param {string} channel - The name of the channel to retrieve the last event from.
   * @returns {TEvent | undefined} The last event that was published on the channel, or undefined if no event has been published.
   */
   lastEvent<TData>(channel: string): TData | undefined {
      return this.getOrCreateChannel<TData>(channel).lastEvent;
  }
}





