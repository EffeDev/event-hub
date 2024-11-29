import {EventHub, Subscription} from "./event-hub";

export interface IConnector {

  /** 
   * The event hubs that this connector is connected to
   */
  eventHubs: EventHub[];

  /**
   * The name of the connector.
   */
  name: string;

  /**
   * Enable a Connector to service multiple event hubs.
   *
   * @param hub
   */
  addEventHub(hub: EventHub): IConnector;

   /**
   * Initialise a Connector with an event hub.
   *
   * @description
   * This method handles the initialization logic when connecting a connector to an event hub.
   * It can be overridden by child classes to implement custom initialization behavior.
   *
   * @param hub - The EventHub instance to initialize the connector with
   * @param channels - Array of channel names that this connector should subscribe to
   * @returns void
   * @protected
   */
  initialiseEventHub(hub: EventHub, channels: string[]): IConnector;

  /**
   * Connect to the EventHub.
   *
   * @description
   * This method is called when the connector is added to the EventHub.
   * It allows the connector to perform any necessary setup or initialization.
   *
   * @param hub
   * @param channels
   */
  connect(hub: EventHub, channels: string[]): Promise<void>;

  /**
   * Disconnect from the EventHub.
   *
   * @description
   * This method is called when the connector is removed from the EventHub.
   * It allows the connector to perform any necessary cleanup or teardown.
   *
   */
  disconnect(): Promise<void>;
}

/**
 * BaseConnector
 *
 * @description
 * The BaseConnector class is an abstract class that provides a base implementation for connectors.
 *
 * @class
 */
export abstract class BaseConnector implements IConnector {
  protected eventHubSubscriptions: Subscription[] = [];
  protected channels: string[] = [];

  eventHubs : EventHub[] = [];

  name: string = 'BaseConnector';

  addEventHub(hub: EventHub): IConnector {
    this.eventHubs.push(hub);
    this.initialiseEventHub(hub, this.channels);

    return this;
  }

  abstract initialiseEventHub(hub: EventHub, channels: string[]): IConnector;

  
  abstract connect(hub: EventHub, channels: string[]): Promise<void>;


  abstract disconnect(): Promise<void>;

}
