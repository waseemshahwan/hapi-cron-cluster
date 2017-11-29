/*********************************************************************************
 1. Dependencies
 *********************************************************************************/

const Hoek = require('hoek');
const CronJob = require('cron').CronJob;
const PluginPackage = require('../package.json');
const {
    Leader
} = require('mongo-leader');
const {
    MongoClient
} = require('mongodb');


/*********************************************************************************
 2. Internals
 *********************************************************************************/

const internals = {};

internals.trigger = (server, job) => {

    return async () => {

        const isLeader = await server.leader.isLeader();
        server.log([PluginPackage.name], 'IS LEADER ? : ', isLeader);

        if (isLeader) {

            server.log([PluginPackage.name], job.name);
            await server.inject(job.request);
            job.onComplete();
        }
    };
};

internals.onPostStart = (server, jobs, options) => {

    return async () => {

        try {
            const db = await MongoClient.connect(options.lock.url);
            const leader = new Leader(db, {
                ttl: options.lock.ttl,
                wait: options.lock.retry,
                key: options.lockKey
            });
            server.decorate('server', 'leader', leader);

            for (const key of Object.keys(jobs)) {
                await jobs[key].start();
            }

        }
        catch (err) {
            throw err;
        }
    };
};

internals.onPreStop = (jobs) => {

    return async () => {

        for (const key of Object.keys(jobs)) {
            await jobs[key].stop();
        }
    };
};


/*********************************************************************************
 3. Exports
 *********************************************************************************/

const PluginRegistration = (server, options) => {

    Hoek.assert(options.lock.url, 'No mongo url provided.');
    Hoek.assert(options.lock.key, 'No lock key provided.');
    Hoek.assert(options.lock.ttl, 'No lock ttl provided.');
    Hoek.assert(options.lock.retry, 'No lock retry time provided.');

    const jobs = {};

    if (!options.jobs || !options.jobs.length) {
        server.log([PluginPackage.name], 'No cron jobs provided.');
    }
    else {
        options.jobs.forEach((job) => {

            Hoek.assert(!jobs[job.name], 'Job name has already been defined');
            Hoek.assert(job.name, 'Missing job name');
            Hoek.assert(job.time, 'Missing job time');
            Hoek.assert(job.timezone, 'Missing job time zone');
            Hoek.assert(job.request, 'Missing job request options');
            Hoek.assert(job.request.url, 'Missing job request url');

            try {
                jobs[job.name] = new CronJob(job.time, internals.trigger(server, job), null, false, job.timezone);
            }
            catch (err) {
                if (err.message === 'Invalid timezone.') {
                    Hoek.assert(!err, 'Invalid timezone. See https://momentjs.com/timezone for valid timezones');
                }
                else {
                    Hoek.assert(!err, 'Time is not a cron expression');
                }
            }
        });
    }

    server.expose('jobs', jobs);
    server.ext('onPostStart', internals.onPostStart(server, jobs, options));
    server.ext('onPreStop', internals.onPreStop(jobs));
};

exports.plugin = {
    register: PluginRegistration,
    pkg: PluginPackage
};
