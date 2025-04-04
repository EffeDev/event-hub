export default {
    preset: 'ts-jest',
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: { target: 'es6' } }],
    },
    collectCoverage: true,
    collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
    coverageReporters: ['lcovonly', 'text', 'text-summary'],
    coverageThreshold: {
        global: {
            branches: 100, // temporary change: official value is80
            functions: 100, // temporary change: official value is80
            lines: 100, // temporary change: official value is 80
            statements: -10, // temporary change: official value is -10
        },
    },
};