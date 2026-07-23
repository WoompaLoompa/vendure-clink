export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@shocknet|nostr-tools|@noble)/)',
  ],
  collectCoverageFrom: ['src/**/*.ts', '!src/types.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};
