
import { CallbackId, CallbackList, ChannelId, ChannelMetrics, EventCallback, SubscribeOptions, Subscription } from "./types";

/**
 * Manages callback subscribers for a channel.
 *
 * @class Channel
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
export class Channel<TData> {
    private readonly _name: string;
    private _lastEvent: TData|undefined;
    private _lastId = 0;
    private _callbacks: CallbackList<TData> = new Map();
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
  
    /**
     * Subscribes to events on the channel. Each event received will be passed to the callback function.
     *
     * @param {EventCallback<TData>} callback - The function to be called when an event is published on this channel.
     * @param {boolean} [replay=false] - If true, immediately calls the callback with the last event, if one exists.
     * @returns {Subscription} An object containing the unsubscribe method and the subscription ID.
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
  
        // replay the last event
        if(options?.replay && lastEvent) {
            wrappedCallback(lastEvent);
        }
  
        return {
            unsubscribe: () => {
                this._callbacks.delete(id);
            },
            id,
        };
    }
  
    /**
     * Publishes an event to the channel, notifying all subscribers.
     *
     * @param {TData} data - The event data to be published to all subscribers.
     */
    publish(data: TData) {
        this._metrics.publishCount++;
        this._metrics.lastPublishTime = Date.now();

        this._lastEvent = data ;
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