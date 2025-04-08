# EventHub For Front Ends (Effe)

<div align="center">

[![Pipeline](https://github.com/EffeDev/event-hub/actions/workflows/pipeline.yml/badge.svg)](https://github.com/EffeDev/event-hub/actions/workflows/pipeline.yml)

</div>

## The Swiss Army Knife for Front-End Event Architecture

Effe (pronounced "e-ff-y") is a powerful, composable toolkit that connects your frontend JavaScript applications to backend Event Driven Architecture (EDA). It provides a framework-agnostic approach to event handling with a modular design that lets you build exactly what you need.

## Packages

This monorepo contains the following packages:

- [@effedev/event-hub](./packages/event-hub) - The core EventHub component

## Core Components

Effe is built on four foundational components that work together seamlessly while maintaining clear separation of concerns:

### 1. EventHub - The Central Nervous System

The EventHub provides a familiar pub/sub interface for your front-end components:

- **Channel-based messaging** - Organize your events by logical channels
- **Wildcard subscriptions** - Subscribe to all events with the `*` channel
- **Type-safe events** - Leverage TypeScript for type safety across your event system
- **Asynchronous by design** - Built for modern async/await patterns

```typescript
import { EventHub } from '@effedev/event-hub';

// Define type-safe event interfaces
interface UserLoginEvent {
  userId: string;
  timestamp: number;
  sessionId: string;
}

interface UserLogoutEvent {
  userId: string;
  timestamp: number;
  sessionDuration: number;
}

// Create an EventHub
const eventHub = new EventHub();

// Subscribe to events with type safety
const subscription = eventHub.subscribe<UserLoginEvent>('user-login', (event) => {
  console.log(`User ${event.userId} logged in at ${new Date(event.timestamp)}`);
  // TypeScript knows event has userId, timestamp, and sessionId properties
});

// Publish a type-safe event
await eventHub.publish<UserLoginEvent>('user-login', {
  userId: 'user123',
  timestamp: Date.now(),
  sessionId: 'sess_abc123'
});

// Later, unsubscribe when no longer needed
subscription.unsubscribe();
```

### 2. Connectors - The Bridge Builders

Connectors establish the flow of events between your EventHub and external systems:

- **SourceConnector** - Brings external events into your EventHub
- **SinkConnector** - Sends EventHub events to external systems
- **Bidirectional flows** - Combine source and sink connectors for two-way communication
- **Channel mapping** - Route external events to specific EventHub channels

### 3. Transports - The Communication Layer

Transports handle the actual communication with external systems:

- **SourceTransport** - Receives data from external sources
- **SinkTransport** - Sends data to external destinations
- **Connection management** - Handles connection lifecycle and state
- **Protocol abstraction** - Encapsulates protocol-specific details

### 4. Pipelines - The Data Transformation Engine

Pipelines process and transform data as it flows through your system:

- **Multi-stage processing** - Chain filters for complex transformations
- **Type-safe transformations** - Maintain type safety between pipeline stages
- **Error handling** - Graceful handling of transformation errors
- **Validation** - Validate data at any stage of processing

## Getting Started

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Why Effe?

- **Framework agnostic** - Works with React, Vue, Angular, or vanilla JS
- **Lightweight** - Small footprint, no heavy dependencies
- **Extensible** - Easy to extend with custom connectors and transports
- **Type-safe** - Built with TypeScript for robust type checking
- **Testable** - Easy to mock and test each component independently
- **Separation of concerns** - Clean architecture with clear responsibilities

## Connect Your Events to Everything!

With Effe, you can connect your front-end to:

- WebSockets for real-time communication
- REST APIs for traditional request/response
- AWS EventBridge for serverless event routing
- Kafka topics for high-throughput messaging
- Momento Topics for serverless pub/sub
- Custom protocols via custom transports
- Other EventHubs for federated architectures

The possibilities are endless. Mix, match, and compose to build the exact event architecture your application needs.
