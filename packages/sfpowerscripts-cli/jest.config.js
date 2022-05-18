const config = {
    verbose: true,
  };
  
  module.exports = config;
  
  // Or async function
  module.exports = async () => {
    return {
        preset: 'ts-jest',
        restoreMocks: true,
        clearMocks: true,
        resetMocks: true,
    };
  };