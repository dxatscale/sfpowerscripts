module.exports = {
    preset: 'ts-jest/presets/js-with-babel',
    testEnvironment: 'jsdom',
    restoreMocks: true,
    clearMocks: true,
    resetMocks: true,
    globals: {
        'ts-jest': {
            tsconfig: 'tsconfig.json',
            babelConfig: true,
        },
    },
    transformIgnorePatterns: ['/node_modules/(?!@salesforce/source-deploy-retrieve)(.*)'],
};
