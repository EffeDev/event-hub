
import { CallbackId, CallbackList, ChannelId, ChannelMetrics, EventCallback, IChannel, SubscribeOptions, Subscription } from "./types";

/**
 * Manages callback subscribers for a channel.
 *
 * @class Channel
 * @implements {IChannel<TData>}
 * @template TData The type of event data that this channel handles
 * @property {string} _name - The name of the channel
 * @property {TData | undefined} _lastEvent - The last event that was published on the channel
 * @property {number} _lastId - The last assigned callback ID
 * @property {CallbackList<TData>} _callbacks - The callbacks that are subscribed to the channel
 *
 * @description
 * The Channel class is responsible for managing subscriptions and publications for a specific event type.
 * It maintains a list of callback functions and allows publishing events to all subscribers.
 * It also keeps track of the last event published on the channel for potential replay functionality.
 *
 * @example
 * const channel = new Channel<string>('myChannel');
 * const subscription = channel.subscribe((message) => console.log(message));
 * channel.publish('Hello, World!');
 * // Output: Hello, World!
 */
export class Channel<TData> implements IChannel<TData> {
    private readonly _name: string;
    private _lastEvent: TData|undefined;
    private _lastId = 0;
    private _callbacks: CallbackList<TData> = new Map();
    private _groups: Map<string, Set<Subscription>> = new Map();
    private _metrics: ChannelMetrics = {
        publishCount: 0,
        errorCount: 0,
        lastPublishTime: 0,
    };
  
    /**
     * Creates a new Channel instance.
     *
     * @param {string} name - The name of the channel. This is used to identify the channel within the EventHub.
     */
    constructor(name: string) {
      this._name = name;
    }
  
    /**
     * Generates the next unique ID for registered callback functions.
     *
     * @private
     * @returns {number} The next available callback ID.
     */
    private getNextId(): number {
        return ++this._lastId;
    }


  
    private addToGroup(group: string, subscription: Subscription): void {
        if (!this._groups.has(group)) {
            this._groups.set(group, new Set());
        }
        this._groups.get(group)!.add(subscription);
    }

    /**
     * Unsubscribes all callbacks in a specific group
     * 
     * @param group The name of the group to unsubscribe
     */
    unsubscribeGroup(group: string): void {
        const subscriptions = this._groups.get(group);
        if (subscriptions) {
            subscriptions.forEach(sub => sub.unsubscribe());
            this._groups.delete(group);
        }
    }

    /**
     * Subscribes to events on the channel. Each event received will be passed to the callback function.
     *
     * @param {EventCallback<TData>} callback - The function to be called when an event is published on this channel.
     * @param {SubscribeOptions} [options] - Optional settings for the subscription including replay and group.
     * @returns {Subscription} An object containing the unsubscribe method and the subscription ID.
     * @throws {TypeError} If the callback is not a function
     */
    subscribe(callback: EventCallback<TData>, options?: SubscribeOptions): Subscription {
        if (!callback || typeof callback !== 'function') {
            throw new TypeError('Callback must be a function');
        }
        const id = this.getNextId();
           
        const wrappedCallback: EventCallback<TData> = (message) => {
            try {
                callback(message);
            } catch (error) {
                console.error(`Error processing callback [${id}]`, error);
                this._metrics.errorCount++;
            }
        };

        const lastEvent = this._lastEvent;
        this._callbacks.set(id, wrappedCallback);
  
        const subscription = {
            unsubscribe: () => {
                this._callbacks.delete(id);
                // Remove from group if part of one
                if (options?.group) {
                    const groupSubs = this._groups.get(options.group);
                    if (groupSubs) {
                        groupSubs.delete(subscription);
                        if (groupSubs.size === 0) {
                            this._groups.delete(options.group);
                        }
                    }
                }
            },
            id,
        };

        // Add to group if specified
        if (options?.group) {
            this.addToGroup(options.group, subscription);
        }

        // replay the last event
        if(options?.replay && lastEvent !== undefined) {
            wrappedCallback(lastEvent);
        }
  
        return subscription;
    }


  
    /**
     * Publishes an event to the channel, notifying all subscribers.
     *
     * @param {TData} data - The event data to be published to all subscribers.
     */
    publish(data: TData): void {
        this._metrics.publishCount++;
        this._metrics.lastPublishTime = Date.now();

        this._lastEvent = data;
        this._callbacks.forEach((callback) => {
          callback(data);
        });
    }
  
    /**
     * Retrieves the last event that was published on the channel.
     *
     * @returns {TData | undefined} The last event that was published on the channel, or undefined if no event has been published.
     */
    get lastEvent(): TData | undefined {
        return this._lastEvent;
    }
  
    /**
     * Retrieves the name of the channel.
     *
     * @returns {string} The name of the channel.
     */
    get name(): string {
      return this._name;
    }
  
    /**
     * Retrieves the list of callbacks that are subscribed to the channel.
     *
     * @returns {CallbackList<TData>} A Map containing all the callbacks subscribed to the channel, keyed by their subscription IDs.
     */
    get callbacks(): CallbackList<TData> {
        return this._callbacks;
    }

    /**
     * Retrieves the metrics for the channel.
     *
     * @returns {ChannelMetrics} The metrics for the channel.
     */
    get metrics(): ChannelMetrics {
        return this._metrics;
    }
  }








