const express = require('express');
const uuidAPIKey = require('uuid-apikey');
const request = require('request-promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(function (req, res, next) {
    if (req.url.indexOf('/switcher-balance') < 0) {
        return handler(req, res);
    }

    var data = '';
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
let endpoints = [];
let index = 0;

function handler(req, res) {
    const currentNode = index;
    if (endpoints[currentNode].status) {
        req.pipe(request({ url: endpoints[currentNode].uri + req.url }, (error) => {
            if (error) {
                endpoints[currentNode].status = false;
                return handler(req, res);
            }
        })).pipe(res);
    } else {
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
        console.log(`- Adding endpoint ${endpoint.uri}`)
        endpoints.push(endpoint);
    });
}

function generateApiKey() {
    const apikey = uuidAPIKey.create();
    uuid = apikey.uuid;

    console.log('API Key: ', apikey.apiKey);
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

function check(res) {
    res.status(200).send({ message: 'All good', code: 200 });
}

app.get('/switcher-balance/check', (req, res) => {
    check(res);
});

app.get('/check', (req, res) => {
    check(res);
});

app.get('/switcher-balance/checkhealth', auth, async (req, res) => {
    let result = [];
    for (let i = 0; i < endpoints.length; i++) {
        const endpoint = endpoints[i];
        const startTime = Date.now();
        try {
            await request({ url: endpoint.uri + endpoint.check_endpoint }, (error, response, body) => {
                if (!error) {
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
    res.send(result);
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

app.post('/switcher-balance', auth, (req, res, next) => {
    const endpoint = {
        name: req.body.name,
        uri: req.body.uri,
        check_endpoint: req.body.check_endpoint,
        status: req.body.status
    };
    
    const foundExisting = endpoints.find(endpt => endpt.name === req.body.name);
    if (foundExisting) {
        return res.status(400).send({ error: `${req.body.name} already exists` });
    }

    endpoints.push(endpoint);
    res.send(endpoint);
});

app.get('*', handler).post('*', handler).patch('*', handler).delete('*', handler);

module.exports = {
    app,
    initializeEndpoints,
    generateApiKey
};