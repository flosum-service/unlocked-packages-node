// eslint-disable-next-line no-unused-expressions
(async () => {
  try {
    require('./config/dotenv').configureEnv();
    // Start API
    require('./app').startAPI();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('Error on API start up:\n%o', error);
  }
})();
