const { app, initializeEndpoints, generateApiKey } = require('./app');

const port = process.env.PORT

app.listen(port, () => {
    console.log('Server is up on port ' + port);
    initializeEndpoints();
    generateApiKey();
});