const express = require('express');
const uuidAPIKey = require('uuid-apikey');
const request = require('request-promise');
const cors = require('cors');
const helmet = require('helmet');
const { scheduleRecover, forceRecover, retrieveNode, checkOfflineNodes, logger } = require('./util/index');
let { index, endpoints, offlineNodes } = require('./controller/index');

const app = express();

app.use(cors());
app.use(helmet());
app.disable('x-powered-by');
app.use(function (req, res, next) {
    if (req.url.indexOf('/switcher-balance') < 0) {
        return handler(req, res);
    }

    let data = '';
    req.on('data', function (chunk) {
        data += chunk;
    });

    req.on('end', function () {
        req.rawBody = data;
        if (data && data.indexOf('{') > -1) {
            req.body = JSON.parse(data);
        }
        next();
    });
});

let uuid = '';

function handler(req, res) {
    const currentNode = index;
    checkOfflineNodes(offlineNodes);

    if (endpoints[currentNode].status) {
        req.pipe(request({ url: endpoints[currentNode].uri + req.url }, (error) => {
            if (error) {
                endpoints[currentNode].status = false;
                scheduleRecover(endpoints[currentNode], offlineNodes, checkNode);
                return handler(req, res);
            }
        })).pipe(res);
    } else {
        forceRecover(endpoints[currentNode], checkNode);
        if (!checkNodes()) {
            return res.status(500).send({ error: 'All nodes are offline' });
        }

        nextNode();
        req.pipe(request({ url: endpoints[index].uri + req.url })).pipe(res);
    }
    nextNode();
}

function checkNodes() {
    const online = endpoints.filter(node => node.status);
    return online.length;
}

function nextNode() {
    index = (index + 1) % endpoints.length;
}

function initializeEndpoints() {
    endpoints = [];
    const nodes = Object.keys(process.env).filter(key => key.indexOf('SNODE') >= 0);
    nodes.forEach(node => {
        const endpoint = {
            name: node,
            uri: process.env[`${node}`],
            check_endpoint: process.env.CHECK_ENDPOINT,
            status: true
        };
        logger(`- Adding endpoint ${endpoint.uri}`);
        endpoints.push(endpoint);
    });
}

function generateApiKey() {
    const apikey = uuidAPIKey.create();
    uuid = apikey.uuid;

    logger(`API Key: ${apikey.apiKey}`);
    return apikey.apiKey;
}

function auth(req, res, next) {
    try {
        const apikey = req.header('switcher-load-key');
        if (uuidAPIKey.check(apikey, uuid))
            return next();
            
        throw new Error();
    } catch (e) {
        res.status(401).send({ error: 'Invalid API Key' });
    }
}

// Check Load Balance endpoint
function check(res) {
    res.status(200).send({ 
        message: 'All good', 
        code: 200,
        online: endpoints,
        offline: offlineNodes
    });
}

// Check Node endpoints
async function checkNode(endpoint, result = []) {
    try {
        const startTime = Date.now();
        await request({ url: endpoint.uri + endpoint.check_endpoint }, (error, response, body) => {
            if (!error) {
                retrieveNode(endpoint, offlineNodes);
                result.push({
                    name: endpoint.name,
                    uri: endpoint.uri,
                    status: endpoint.status,
                    time: Date.now() - startTime,
                    statusCode: response && response.statusCode,
                    body: JSON.parse(body)
                });
            }
        });
    } catch (e) {
        result.push({
            name: endpoint.name,
            uri: endpoint.uri,
            status: endpoint.status,
            error: e
        });
    }
}

app.get('/switcher-balance/check', (_req, res) => {
    check(res);
});

app.get('/check', (_req, res) => {
    try {
        check(res);
    } catch (e) {
        res.status(500).send({ error: e.message });
    }
});

app.get('/switcher-balance/checkhealth', auth, async (_req, res) => {
    try {
        let result = [];
        for (let endpoint of endpoints) {
            await checkNode(endpoint, result);
        }
        res.send(result);
    } catch (e) {
        res.status(500).send({ error: e.message });
    }
});

app.patch('/switcher-balance/:name', auth, (req, res) => {
    const node = endpoints.filter(endpoint => endpoint.name === req.params.name);
    
    if (!node.length) {
        return res.status(404).send();
    }

    if (req.body.status != undefined) node[0].status = req.body.status;
    if (req.body.uri) node[0].uri = req.body.uri;
    if (req.body.check_endpoint) node[0].check_endpoint = req.body.check_endpoint;
    if (req.body.name) node[0].name = req.body.name;

    res.send(node[0]);
});

app.delete('/switcher-balance/:name', auth, (req, res) => {
    const node = endpoints.filter(endpoint => endpoint.name === req.params.name);
    
    if (!node.length) {
        return res.status(404).send();
    }

    const endpointIndex = endpoints.indexOf(node[0]);
    endpoints.splice(endpointIndex, 1);
    res.send(node);
});

app.post('/switcher-balance', auth, (req, res) => {
    const endpoint = {
        name: req.body.name,
        uri: req.body.uri,
        check_endpoint: req.body.check_endpoint,
        status: req.body.status
    };
    
    const foundExisting = endpoints.find(endpt => endpt.name === req.body.name);
    if (foundExisting) {
        return res.status(400).send({ error: `${foundExisting.name} already exists` });
    }

    endpoints.push(endpoint);
    res.send({ message: 'Endpoint added' });
});

app.get('*', handler).post('*', handler).patch('*', handler).delete('*', handler);

module.exports = {
    app,
    initializeEndpoints,
    generateApiKey
};