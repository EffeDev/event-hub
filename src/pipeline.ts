/**
 * Represents the result of a pipeline stage execution
 * @template T The type of data being processed
 */
export type PipelineResult<T> = {
    /** Indicates if the pipeline stage executed successfully */
    success: boolean;
    /** The processed data if successful */
    data?: T;
    /** Any error that occurred during processing */
    error?: Error;
};

/**
 * Interface for pipeline filters that process data
 * @template TInput The input data type
 * @template TOutput The output data type after processing
 */
export interface IPipelineFilter<TInput, TOutput> {
    /**
     * Process the input data and return a result
     * @param data The input data to process
     * @returns A promise resolving to the processing result
     */
    process(data: TInput): Promise<PipelineResult<TOutput>>;
}

/**
 * Implements a processing pipeline that can transform data through multiple stages
 * 
 * @template TInput The type of data that enters the pipeline
 * @template TOutput The type of data that exits the pipeline after all transformations
 * 
 * @description
 * The Pipeline class allows you to chain multiple processing stages together, where each stage
 * can transform the data from one type to another. The pipeline processes data sequentially
 * through each stage, and if any stage fails, the pipeline stops processing and returns an error.
 * 
 * @example
 * // Create a proper filter class
 * class StringToNumberFilter implements IPipelineFilter<string, number> {
 *   async process(data: string): Promise<PipelineResult<number>> {
 *     const num = Number(data);
 *     if (isNaN(num)) {
 *       return { success: false, error: new Error('Invalid number') };
 *     }
 *     return { success: true, data: num };
 *   }
 * }
 * 
 * class NumberToHexFilter implements IPipelineFilter<number, string> {
 *   async process(data: number): Promise<PipelineResult<string>> {
 *     return { success: true, data: data.toString(16) };
 *   }
 * }
 * 
 * // Create and chain pipelines.
 * // When creating a new Pipeline with no filters you need to construct with only the Input data type.
 * // The actual final Pipeline Type will change as you add filters that transform the data to a new type.
 * // Its tricky at first but it makes sense when building out more complex filter Pipelines.
 * const pipeline = new Pipeline<string>()
 *   .add(new StringToNumberFilter())
 *   .add(new NumberToHexFilter());
 * 
 * // Process data through the pipeline
 * const result = await pipeline.process("123");
 * if (result.success) {
 *   console.log(result.data); // "7b"
 * }
 */
export class Pipeline<TInput, TOutput = TInput> {
    /** Array of pipeline stages that will process the data */
    private filters: IPipelineFilter<any, any>[] = [];

    /**
     * Get size of the pipeline
     * 
     * @returns number of filters in the pipeline
     */
    get size() {
        return this.filters.length;
    }
    
    /**
     * Adds a new processing stage to the pipeline
     * 
     * @template TIntermediate The intermediate output type of this stage
     * @param filter The filter to add to the pipeline
     * @returns A new pipeline with the added filter
     * 
     * @example
     * // Create filter classes
     * class StringToNumberFilter implements IPipelineFilter<string, number> {
     *   async process(data: string): Promise<PipelineResult<number>> {
     *     return { success: true, data: parseInt(data) };
     *   }
     * }
     * 
     * class NumberToHexFilter implements IPipelineFilter<number, string> {
     *   async process(data: number): Promise<PipelineResult<string>> {
     *     return { success: true, data: data.toString(16) };
     *   }
     * }
     * 
     * // Chain filters together
     * const pipeline = new Pipeline<string>()
     *   .add(new StringToNumberFilter())
     *   .add(new NumberToHexFilter());
     */
    add<TIntermediate>(filter: IPipelineFilter<TOutput, TIntermediate>): Pipeline<TInput, TIntermediate> {
        // Runtime validations
        if (!filter) {
            throw new Error('Filter cannot be null or undefined');
        }
        
        if (typeof filter.process !== 'function') {
            throw new Error('Filter must implement process method');
        }

        // Create a new pipeline with the new output type
        const newPipeline = new Pipeline<TInput, TIntermediate>();
        
        // Copy all existing filters
        newPipeline.filters = [...this.filters, filter];
        
        return newPipeline;
    }

    /**
     * Processes input data through all pipeline stages
     * 
     * @param data The input data to process
     * @returns A promise that resolves to the final processing result
     * 
     * @description
     * This method runs the input data through each stage of the pipeline in sequence.
     * If any stage fails (returns success: false), the pipeline stops processing and
     * returns the error. If all stages succeed, the final transformed data is returned.
     * 
     * @example
     * // Create proper filter classes
     * class StringToNumberFilter implements IPipelineFilter<string, number> {
     *   async process(data: string): Promise<PipelineResult<number>> {
     *     return { success: true, data: parseInt(data) };
     *   }
     * }
     * 
     * class NumberDoubleFilter implements IPipelineFilter<number, number> {
     *   async process(data: number): Promise<PipelineResult<number>> {
     *     return { success: true, data: data * 2 };
     *   }
     * }
     * 
     * // Build the pipeline with proper filter classes
     * const pipeline = new Pipeline<string>()
     *   .add(new StringToNumberFilter())
     *   .add(new NumberDoubleFilter());
     * 
     * const result = await pipeline.process("123");
     * if (result.success) {
     *   console.log("Processed value:", result.data); // 246
     * } else {
     *   console.error("Processing failed:", result.error);
     * }
     */
    async process(data: TInput): Promise<PipelineResult<TOutput>> {
        try {
            let result: any = data;
            for (const filter of this.filters) {
                const filterResult = await filter.process(result);
                if (!filterResult.success) {
                    return { success: false, error: filterResult.error };
                }
            
                // Check for null/undefined data - early exit but not an error
                if (filterResult.data === null || filterResult.data === undefined) {
                    return { success: true, data: undefined };
                }

                result = filterResult.data;
            }
            return { success: true, data: result as TOutput };
        } catch (error) {
            return { success: false, error: error as Error };
        }
    }
}

