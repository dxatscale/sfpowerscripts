module.exports = {
    preset: 'ts-jest/presets/js-with-babel',
    testEnvironment: 'node',
    restoreMocks: true,
    clearMocks: true,
    resetMocks: true,
    transform: {
    '^.+\\.[t]sx?$': [
        'ts-jest',
         {
            tsconfig: 'tsconfig.json',
            babelConfig: true,
        },
      ]
    },
    transformIgnorePatterns: ['/node_modules/(?!@salesforce/source-deploy-retrieve)(.*)'],
    moduleNameMapper: {
        '^axios$': require.resolve('axios'),
    }
};
