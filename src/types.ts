
/**
 * Function signature for callbacks registered for receiving events on a channel.
 *
 * @template TData The type of data contained in the event message.
 * @callback EventCallback
 * @param {EventMessage<TData>} event - The event message that was published on the channel.
 * @returns {void}
 *
 * @example
 * const callback: EventCallback<string> = (message) => {
 *   console.log(`Received message on channel ${message.channel}: ${message.data}`);
 * };
 */
export type EventCallback<TData> = (data:TData) => void;

/**
 * Constant representing the wild card channel where ALL events get broadcast to.
 */
export const WildCardChannel = '*';

/**
 * Subscription object returned when a callback is subscribed to an EventHub channel.
 * It contains the unsubscribe function to de-register a callback from the EventHub channel
 * and the unique identifier for this subscription.
 *
 * @property {() => void} unsubscribe - Function to unsubscribe the callback from the channel.
 * @property {number} id - Unique identifier for this subscription.
 *
 * @example
 * const subscription = eventHub.subscribe('myChannel', myCallback);
 * // Later, to unsubscribe:
 * subscription.unsubscribe();
 */
export interface Subscription {
    unsubscribe: () => void;
    id: number;
}

/**
 * Represents metrics for a channel, including the number of publishes, errors, and the last publish time.
 *
 * @property {number} publishCount - The total number of events published on the channel.
 * @property {number} errorCount - The total number of errors encountered while publishing events on the channel.
 * @property {number} lastPublishTime - The timestamp of the last event published on the channel.
 *
 * @example
 * const metrics: ChannelMetrics = {
 *   publishCount: 10,
 *   errorCount: 2,
 *   lastPublishTime: 1621234567890
 * };
 */
export interface ChannelMetrics {
    publishCount: number;
    errorCount: number;
    lastPublishTime: number;
}

/**
 * Represents the Id of a Channel
 */
export type ChannelId = string;

/**
 * Represents the Id of a Callback
 */
export type CallbackId = number;

/**
 * Represents a list of callbacks subscribed to a channel, indexed by their subscription IDs.
 *
 * @template TData The type of data that the event messages include.
 */
export type CallbackList<TData> = Map<CallbackId, EventCallback<TData>>;

/**
 * Interface defining the contract for a Channel implementation.
 * 
 * @template TData The type of data that this channel handles
 */
export interface IChannel<TData> {
    /**
     * Subscribes to events on the channel
     * @param callback The function to be called when an event is published
     * @param options Subscription options including replay and group
     */
    subscribe(callback: EventCallback<TData>, options?: SubscribeOptions): Subscription;

    /**
     * Publishes an event to all subscribers
     * @param data The event data to publish
     */
    publish(data: TData): void;

    /**
     * Gets the last event published on this channel
     */
    readonly lastEvent: TData | undefined;

    /**
     * Gets the name of the channel
     */
    readonly name: string;

    /**
     * Gets the list of callbacks subscribed to this channel
     */
    readonly callbacks: CallbackList<TData>;

    /**
     * Gets the metrics for this channel
     */
    readonly metrics: ChannelMetrics;
}

/**
 * Subscribe Options for Channel Subscription
 * 
 * @property {boolean} [replay=false] - If true, immediately calls the callback with the last event, if one exists.
 * @property {string} [group] - The group to which the subscription belongs to enable faster unsubscribing for more complex use cases.
 *
 * @example
 * const options: SubscribeOptions = {
 *   replay: true,
 *   group: 'myGroup',
 * };
 */
export  interface SubscribeOptions {
    replay?: boolean;
    group?: string;
}
