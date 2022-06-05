const request = require('supertest');
const nock = require('nock')
const { app, generateApiKey, initializeEndpoints } = require('../src/app');

describe('Insertion tests', () => {

    let apiKey;

    beforeAll(() => {
        apiKey = generateApiKey();
        
        process.env.SNODE1 = 'http://127.0.0.1:3001';
        process.env.SNODE2 = 'http://127.0.0.1:3002';
        process.env.CHECK_ENDPOINT = '/switcher-balance/check';
        process.env.RECOVER_ATTEMPT_DURATION = 2;
        process.env.RECOVER_INTERVAL = 1;
        initializeEndpoints();
    })

    afterEach(() => {
        nock.cleanAll();
    });

    test('should check load balance', async () => {
        const internalCheckResponse = await request(app)
            .get('/switcher-balance/check')
            .send().expect(200);

        expect(internalCheckResponse.body).toMatchObject({ message: 'All good', code: 200 });
    });

    test('should return sucess on checking health from 2 different nodes', async () => {
        nock('http://127.0.0.1:3001').get(`/switcher-balance/check`).reply(200, { message: 'All good', code: 200 });
        nock('http://127.0.0.1:3002').get(`/switcher-balance/check`).reply(200, { message: 'All good', code: 200 });

        const response = await request(app)
            .get('/switcher-balance/checkhealth')
            .set('switcher-load-key', apiKey)
            .send().expect(200);

        expect(response.body.length == 2).toEqual(true);
        expect(response.body[0].name).toEqual('SNODE1');
        expect(response.body[1].name).toEqual('SNODE2');
    });
    
    test('should NOT return success when check health for one of the configured nodes', async () => {
        nock('http://127.0.0.1:3001').get(`/switcher-balance/check`).reply(200, { message: 'All good', code: 200 });

        const response = await request(app)
            .get('/switcher-balance/checkhealth')
            .set('switcher-load-key', apiKey)
            .send().expect(200);

        const node2offline = response.body.find(node => node.name === 'SNODE2');
        expect(node2offline.error).not.toBe(undefined);

        const node1online = response.body.find(node => node.name === 'SNODE1');
        expect(node1online.error).toBe(undefined);
    });

    test('should create new node', async () => {
        const response = await request(app)
            .post('/switcher-balance')
            .set('switcher-load-key', apiKey)
            .send({
                name: 'SNODE3',
                uri: 'http://127.0.0.1:3003',
                check_health: '/check',
                status: false
            }).expect(200);

        expect(response.body).toMatchObject({
            name: 'SNODE3',
            uri: 'http://127.0.0.1:3003',
            status: false
         });
    });

    test('should NOT create new node - alias already exist', async () => {
        const response = await request(app)
            .post('/switcher-balance')
            .set('switcher-load-key', apiKey)
            .send({
                name: 'SNODE1',
                uri: 'http://localhost:3003',
                check_health: '/check',
                status: false
            }).expect(400);

        expect(response.body.error).toEqual(`SNODE1 already exists`);
    });

    test('should NOT delete node - alias does not exist', async () => {
        await request(app)
            .delete('/switcher-balance/SNODE111')
            .set('switcher-load-key', apiKey)
            .send().expect(404);
    });

    test('should delete a node', async () => {
        await request(app)
            .delete('/switcher-balance/SNODE3')
            .set('switcher-load-key', apiKey)
            .send().expect(200);
    });

    test('should NOT update a node', async () => {
        await request(app)
            .patch('/switcher-balance/SNODE111')
            .set('switcher-load-key', apiKey)
            .send({
                status: false
            }).expect(404);
    });

    test('should update a node', async () => {
        await request(app)
            .patch('/switcher-balance/SNODE1')
            .set('switcher-load-key', apiKey)
            .send({
                status: false,
                name: 'SNODE111',
                uri: 'http://127.0.0.1:3001',
                check_endpoint: '/switcher-balance/check'
            }).expect(200);
    });

    test('should NOT update a node - Wrong API Key', async () => {
        await request(app)
            .patch('/switcher-balance/SNODE1')
            .set('switcher-load-key', 'WRONG-KEY')
            .send({
                status: false
            }).expect(401);
    });
    
    test('should try access configured endpoint', async () => {
        nock('http://127.0.0.1:3001').get(`/check`).reply(200, { message: 'All good', code: 200 });
        nock('http://127.0.0.1:3002').get(`/check`).reply(200, { message: 'All good', code: 200 });

        await request(app).get('/check').send();
    });

    test('should try access one offline configured endpoint', async () => {
        initializeEndpoints();
        nock('http://127.0.0.1:3002').get(`/check`).reply(200, { message: 'All good', code: 200 });
        const response = await request(app).get('/check').send();
        expect(response.body.code).toEqual(200);
    });

    test('should try access one offline configured endpoint', async () => {
        initializeEndpoints();
        await request(app)
            .patch('/switcher-balance/SNODE1')
            .set('switcher-load-key', apiKey)
            .send({
                status: false,
            }).expect(200);

        await request(app)
            .patch('/switcher-balance/SNODE2')
            .set('switcher-load-key', apiKey)
            .send({
                status: false,
            }).expect(200);

        nock('http://127.0.0.1:3001').get(`/check`).reply(200, { message: 'All good', code: 200 });
        nock('http://127.0.0.1:3002').get(`/check`).reply(200, { message: 'All good', code: 200 });

        const response = await request(app).get('/check').send();
        expect(response.body.error).toEqual('All nodes are offline');
     });

     test('should recovery one offline node', async () => {
        initializeEndpoints();

        // Nodes are offline
        let response = await request(app).get('/check').send();
        expect(response.body.error).toEqual('All nodes are offline');

        // Retrieving one node
        nock('http://127.0.0.1:3001').get(`/check`).reply(200, { message: 'All good', code: 200 });
        nock('http://127.0.0.1:3001').get(`/switcher-balance/check`).reply(200, { message: 'All good', code: 200 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        response = await request(app).get('/check').send();
        expect(response.body.code).toEqual(200);
     }, 8000);

});