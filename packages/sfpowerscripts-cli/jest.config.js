module.exports = {
    preset: 'ts-jest/presets/js-with-babel',
    testEnvironment: 'node',
    restoreMocks: true,
    clearMocks: true,
    resetMocks: true,
    globals: {
      'ts-jest': {
        babelConfig: true,
      }
    },
    transformIgnorePatterns: ['/node_modules/(?!@salesforce/source-deploy-retrieve)(.*)'],
};
