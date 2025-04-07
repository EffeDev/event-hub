import { Channel } from './channel';
import { EventHub } from './event-hub';
import { Pipeline, PipelineResult, IPipelineFilter } from './pipeline';
import { BaseTransport, ITransport, SourceTransport, SinkTransport } from './transport';
import { EventCallback, Subscription } from './types';

/**
 * Core components for event handling and communication
 */
export { 
    // Event system
    Channel,
    EventHub,
    EventCallback,
    Subscription,
    
    // Pipeline system
    Pipeline,
    PipelineResult,
    IPipelineFilter,
    
    // Transport system
    BaseTransport,
    ITransport,
    SourceTransport,
    SinkTransport,
};
