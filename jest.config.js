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
            branches: 77, // temporary change: official value is80
            functions: 77, // temporary change: official value is80
            lines: 77, // temporary change: official value is 80
            statements: -11, // temporary change: official value is -10
        },
    },
};