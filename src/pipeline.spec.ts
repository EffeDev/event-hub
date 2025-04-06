import { Pipeline } from './index';
import { IPipelineFilter } from './pipeline';

describe('[Pipeline]: Construction and Filter Addition', () => {
  let pipeline: Pipeline<string, string>;

  beforeEach(() => {
    pipeline = new Pipeline<string, string>();
  });

  it('Should create an empty pipeline', () => {
    expect(pipeline).toBeDefined();
  });

  it('Should allow adding a filter', () => {
    const filter: IPipelineFilter<string, number> = {
      async process(data: string): Promise<{ success: boolean; data?: number; error?: Error }> {
        return { success: true, data: parseInt(data) };
      }
    };

    const newPipeline = pipeline.add(filter);
    expect(newPipeline).toBeDefined();
    expect(newPipeline.size).toBe(1);
  });

  it('Should allow chaining multiple filters', () => {
    const stringToNumber: IPipelineFilter<string, number> = {
      async process(data: string) {
        return { success: true, data: parseInt(data) };
      }
    };

    const numberToHex: IPipelineFilter<number, string> = {
      async process(data: number) {
        return { success: true, data: data.toString(16) };
      }
    };

    const chainedPipeline = pipeline
      .add(stringToNumber)
      .add(numberToHex);

    expect(chainedPipeline).toBeDefined();
  });
});

describe('[Pipeline]: Data Processing', () => {
  let pipeline: Pipeline<string, number>;

  beforeEach(() => {
    pipeline = new Pipeline<string, number>();
  });

  it('Should process data through a single filter successfully', async () => {
    pipeline.add({
      async process(data: string) {
        const num = parseInt(data);
        return { success: true, data: num };
      }
    });

    const result = await pipeline.process('123');
    expect(result.success).toBe(true);
    expect(result.data).toBe(123);
  });

  it('Should process data through multiple filters successfully', async () => {
    const finalPipeline = pipeline
      .add({
        async process(data: string) {
          return { success: true, data: parseInt(data) };
        }
      })
      .add({
        async process(data: number) {
          return { success: true, data: data * 2 };
        }
      });

    const result = await finalPipeline.process('123');
    expect(result.success).toBe(true);
    expect(result.data).toBe(246);
  });

  it('Should handle filter errors gracefully', async () => {
    pipeline.add({
      async process(data: string) {
        if (isNaN(parseInt(data))) {
          return { success: false, error: new Error('Invalid number') };
        }
        return { success: true, data: parseInt(data) };
      }
    });

    const result = await pipeline.process('not a number');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe('Invalid number');
  });

  it('Should stop processing on first filter failure', async () => {
    let secondFilterCalled = false;

    pipeline
      .add({
        async process(_data: string) {
          return { success: false, error: new Error('First filter error') };
        }
      })
      .add({
        async process(data: number) {
          secondFilterCalled = true;
          return { success: true, data: data };
        }
      });

    const result = await pipeline.process('123');
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('First filter error');
    expect(secondFilterCalled).toBe(false);
  });

  it('Should handle thrown exceptions in filters', async () => {
    pipeline.add({
      async process(_data: string) {
        throw new Error('Unexpected error');
      }
    });

    const result = await pipeline.process('123');
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Unexpected error');
  });

  it('Should handle null/undefined data as valid but empty result', async () => {
    pipeline.add({
      async process(_data: string) {
        return { success: true, data: undefined };
      }
    });

    const result = await pipeline.process('test');
    expect(result.success).toBe(true);
    expect(result.data).toBeUndefined();
  });
});

describe('[Pipeline]: Complex Transformations', () => {
  it('Should handle complex type transformations', async () => {
    interface User { name: string; age: number; }
    
    const pipeline = new Pipeline<string, User>();
    
    pipeline
      .add({
        async process(data: string) {
          const [name, age] = data.split(',');
          if (!name || !age) {
            return { success: false, error: new Error('Invalid input format') };
          }
          return { success: true, data: { name, age: parseInt(age) } };
        }
      });

    const result = await pipeline.process('John Doe,30');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'John Doe', age: 30 });
  });

  it('Should handle async operations in filters', async () => {
    const pipeline = new Pipeline<number, string>();
    
    pipeline.add({
      async process(data: number) {
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true, data: data.toString() };
      }
    });

    const startTime = Date.now();
    const result = await pipeline.process(123);
    const endTime = Date.now();

    expect(result.success).toBe(true);
    expect(result.data).toBe('123');
    expect(endTime - startTime).toBeGreaterThanOrEqual(100);
  });
});