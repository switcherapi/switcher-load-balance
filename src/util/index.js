const schedule = require('node-schedule');

function scheduleRecover(endpoint, offlineNodes, checkNode) {
    offlineNodes.push(endpoint);

    let startTime = new Date(Date.now());
    let endTime = new Date(startTime.getTime() + (process.env.RECOVER_ATTEMPT_DURATION * 1000));
    schedule.scheduleJob(endpoint.name, {
        start: startTime,
        end: endTime,
        rule: `*/${process.env.RECOVER_INTERVAL} * * * * *`
    }, function () {
        logger(`Trying to retrieve node ${endpoint.name}`);
        checkNode(endpoint);
    });
}

function forceRecover(endpoint, checkNode) {
    logger(`Trying to force retrieve node ${endpoint.name}`);
    checkNode(endpoint);
}

function retrieveNode(endpoint, offlineNodes) {
    const offlineNode = offlineNodes.find(node => node.name === endpoint.name);

    if (offlineNode) {
        logger(`Node ${endpoint.name} online`);
        schedule.cancelJob(endpoint.name);
        offlineNodes.splice(offlineNodes.indexOf(offlineNode), 1);
        endpoint.status = true;
    }
}

function checkOfflineNodes(offlineNodes) {
    offlineNodes.forEach(offlineNode => {
        if (schedule.scheduledJobs[`${offlineNode.name}`] &&
            schedule.scheduledJobs[`${offlineNode.name}`].nextInvocation() == null) {
            let startTime = new Date(Date.now());
            let endTime = new Date(startTime.getTime() + (process.env.RECOVER_ATTEMPT_DURATION * 1000));

            logger(`Rescheduling ${offlineNode.name} recovery`);
            schedule.rescheduleJob(offlineNode.name, {
                start: startTime,
                end: endTime,
                rule: `*/${process.env.RECOVER_INTERVAL} * * * * *`
            });
        }
    });
}

function logger(value) {
    if (process.env.LOGGER === 'true')
        console.log(value);
}

module.exports = {
    scheduleRecover,
    forceRecover,
    checkOfflineNodes,
    retrieveNode,
    logger
}