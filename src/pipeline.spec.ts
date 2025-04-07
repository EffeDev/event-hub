import { IPipelineFilter, Pipeline, PipelineResult } from './index';

// Create proper filter classes for testing
class StringToNumberFilter implements IPipelineFilter<string, number> {
  async process(data: string): Promise<PipelineResult<number>> {
    return { success: true, data: parseInt(data) };
  }
}

class NumberToHexFilter implements IPipelineFilter<number, string> {
  async process(data: number): Promise<PipelineResult<string>> {
    return { success: true, data: data.toString(16) };
  }
}

class NumberDoubleFilter implements IPipelineFilter<number, number> {
  async process(data: number): Promise<PipelineResult<number>> {
    return { success: true, data: data * 2 };
  }
}

class InvalidNumberFilter implements IPipelineFilter<string, number> {
  async process(data: string): Promise<PipelineResult<number>> {
    if (isNaN(parseInt(data))) {
      return { success: false, error: new Error('Invalid number') };
    }
    return { success: true, data: parseInt(data) };
  }
}

class ErrorThrowingFilter implements IPipelineFilter<string, number> {
  async process(_data: string): Promise<PipelineResult<number>> {
    throw new Error('Unexpected error');
  }
}

class NullReturningFilter implements IPipelineFilter<string, number> {
  async process(_data: string): Promise<PipelineResult<number>> {
    return { success: true, data: undefined };
  }
}

describe('[Pipeline]: Construction and Filter Addition', () => {
  it('Should create an empty pipeline', () => {
    const pipeline = new Pipeline<string, string>();
    expect(pipeline).toBeDefined();
    expect(pipeline.size).toBe(0);
  });

  it('Should allow adding a filter', () => {
    const filter = new StringToNumberFilter();
    const pipeline = new Pipeline<string>();
    const newPipeline = pipeline.add<number>(filter);
    
    expect(newPipeline).toBeDefined();
    expect(newPipeline.size).toBe(1);
    // Original pipeline should remain unchanged
    expect(pipeline.size).toBe(0);
  });

  it('Should allow chaining multiple filters', () => {
    const stringToNumber = new StringToNumberFilter();
    const numberToHex = new NumberToHexFilter();

    const chainedPipeline = new Pipeline<string>()
      .add<number>(stringToNumber)
      .add<string>(numberToHex);

    expect(chainedPipeline).toBeDefined();
    expect(chainedPipeline.size).toBe(2);
  });
});

describe('[Pipeline]: Data Processing', () => {
  it('Should process data through a single filter successfully', async () => {
    const pipeline = new Pipeline<string>()
      .add<number>(new StringToNumberFilter());

    const result = await pipeline.process('123');
    expect(result.success).toBe(true);
    expect(result.data).toBe(123);
  });

  it('Should process data through multiple filters successfully', async () => {
    const pipeline = new Pipeline<string>()
      .add<number>(new StringToNumberFilter())
      .add<number>(new NumberDoubleFilter());

    const result = await pipeline.process('123');
    expect(result.success).toBe(true);
    expect(result.data).toBe(246);
  });

  it('Should handle filter errors gracefully', async () => {
    const pipeline = new Pipeline<string>()
      .add<number>(new InvalidNumberFilter());

    const result = await pipeline.process('not a number');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe('Invalid number');
  });

  it('Should stop processing on first filter failure', async () => {
    let secondFilterCalled = false;

    class FailingFilter implements IPipelineFilter<string, number> {
      async process(_data: string): Promise<PipelineResult<number>> {
        return { success: false, error: new Error('First filter error') };
      }
    }

    class SecondFilter implements IPipelineFilter<number, string> {
      async process(data: number): Promise<PipelineResult<string>> {
        secondFilterCalled = true;
        return { success: true, data: data.toString() };
      }
    }

    const pipeline = new Pipeline<string>()
      .add<number>(new FailingFilter())
      .add<string>(new SecondFilter());

    const result = await pipeline.process('123');
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('First filter error');
    expect(secondFilterCalled).toBe(false);
  });

  it('Should handle thrown exceptions in filters', async () => {
    const pipeline = new Pipeline<string>()
      .add<number>(new ErrorThrowingFilter());

    const result = await pipeline.process('123');
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Unexpected error');
  });

  it('Should handle null/undefined data as valid but empty result', async () => {
    const pipeline = new Pipeline<string>()
      .add<number>(new NullReturningFilter());

    const result = await pipeline.process('test');
    expect(result.success).toBe(true);
    expect(result.data).toBeUndefined();
  });
});

describe('[Pipeline]: Runtime Validations', () => {
  it('Should throw error when adding null filter', () => {
    const pipeline = new Pipeline<string>();
    expect(() => pipeline.add(null as any)).toThrow('Filter cannot be null or undefined');
  });

  it('Should throw error when adding undefined filter', () => {
    const pipeline = new Pipeline<string>();
    expect(() => pipeline.add(undefined as any)).toThrow('Filter cannot be null or undefined');
  });

  it('Should throw error when adding object without process method', () => {
    const pipeline = new Pipeline<string>();
    const invalidFilter = {} as any;
    expect(() => pipeline.add(invalidFilter)).toThrow('Filter must implement process method');
  });

  it('Should throw error when adding object with non-function process property', () => {
    const pipeline = new Pipeline<string>();
    const invalidFilter = { process: 'not a function' } as any;
    expect(() => pipeline.add(invalidFilter)).toThrow('Filter must implement process method');
  });
});

describe('[Pipeline]: Complex Transformations', () => {
  it('Should handle complex type transformations', async () => {
    interface User { name: string; age: number; }
    
    class StringToUserFilter implements IPipelineFilter<string, User> {
      async process(data: string): Promise<PipelineResult<User>> {
        const [name, age] = data.split(',');
        if (!name || !age) {
          return { success: false, error: new Error('Invalid input format') };
        }
        return { success: true, data: { name, age: parseInt(age) } };
      }
    }

    const pipeline = new Pipeline<string>()
      .add<User>(new StringToUserFilter());

    const result = await pipeline.process('John Doe,30');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'John Doe', age: 30 });
  });

  it('Should handle async operations in filters', async () => {
    class AsyncFilter implements IPipelineFilter<number, string> {
      async process(data: number): Promise<PipelineResult<string>> {
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 100));
        return { success: true, data: data.toString() };
      }
    }

    const pipeline = new Pipeline<number>()
      .add<string>(new AsyncFilter());

    const startTime = Date.now();
    const result = await pipeline.process(123);
    const endTime = Date.now();

    expect(result.success).toBe(true);
    expect(result.data).toBe('123');
    expect(endTime - startTime).toBeGreaterThanOrEqual(100);
  });
});


