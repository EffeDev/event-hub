

# EventHub For Front Ends (Effe)

<div align="center">

[![Pipeline](https://github.com/serverless-dna/effe/actions/workflows/pipeline.yml/badge.svg)](https://github.com/serverless-dna/effe/actions/workflows/pipeline.yml)

</div>


Effe (pr. e-ff-y) connects your frontend javascript applications to your backend Event Driven Architecture (EDA).
Effe is a framework-agnostic event hub providing a familiar event bus interface for your front-end components combined 
with an extensible connector interface to enable events to flow between your backend hosted server components and the front-end EventHub.

The implementation is a pure EventHub implementation with clear responsibilities.  EventHub has a single purpose - to transmit events to subscribed callbacks for each channel when a message is published.
A Subscriber may subscribe to ALL messages published on the EventHub by subscribing to the wildcard channel "\*".

The Connector participates in the EventHub pub/sub mechanism by subscribing to one or more channels to receive events, it may also use the wildcard channel "*" to receive all events published on the EventHub.
The EventHub has no knowledge the connector exists and you can have as many connectors as you wish participating in the Pub/Sub eco-system to build complex connected apps which deliver events via different channels.
Connectors have a simple responsibility - for each event received via the subscribed callback or callbacks (there may be many) package up the event data and transmit it to its _Connection_.  Likewise the connector may also publish
events to the EventHub when data is received (if the connector is a bi-directional style connector).  In this way the Connector is the **Bridge** between the pub/sub EventHub and the external event source.

> We like to think of this setup as EventBridge for your FrontEnd Web Apps.

This implementation maintains a clear separation of responsibilities.  Connectors are simply Pub/Sub participants who have a special job - to connect the EventHub to an external server or source.
This could be anything at all - WebSockets, Momento Topics, an API, AWS EventBridge, Kafka Topics, event other EventHubs! - anywhere you need to connect your events.  You can create multiple connectors to handle events from your EventHub in many different ways.
We love the Pub/Sub model and think it simplifies your Front-End to no end.  

> _GO wild - connect your events to everything!_

## Overview of EventHub Interactions using a WebSocket Connector

![](assets/eventhub-overview.png)

- WebUI subscribes to a channel to receive events from the EventHub using a callback function.
- EventHub calls subscriber callbacks for any channel for each event that is published
- Connector is connected to the EventHub and subscribes to one or more channels (implementation dependent).
- WebSocket connector also connects to a websocket server and is responsible for reformatting the EventHub events to the correct format for the WebSocket protocol being used.
- WebSocket Connector also listens to the websocket for messages coming back and for each message will reformat them into a compatible EventHub message.  
- The WebSocket Connector will publish the reformatted event to the channel identified in the message completing the end to end communication loop.

**Important Note:** Websockets do not implement publish/subscribe patterns, they enable transportation of data from a client to the server using a negotiated Sub-protocol which determines the data which flows between them.
This is why we have created the IConnector Interface - to enable connections to servers using any kind of transport mechanism you need - like WebSockets - these are a Connector.
You can implement the connectors any way you like - it's up to you how you connect your EventHubs.
