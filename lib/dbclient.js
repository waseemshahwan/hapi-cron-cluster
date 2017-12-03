/*********************************************************************************
 1. Dependencies
 *********************************************************************************/
const MongoLeader = require('mongo-leader');
const {
    MongoClient
} = require('mongodb');
const Redis = require('redis');
const Lock = require('redislock');


exports.connect = (server, options) => {

    if (options.lock.url.startsWith('mongodb')) {

        return MongoClient.connect(options.lock.url).then((db) => {

            const leader = new MongoLeader.Leader(db, {
                ttl: options.lock.ttl,
                wait: options.lock.retry,
                key: options.lockKey
            });
            server.decorate('server', 'leader', leader);
        });
    }
    else if (options.lock.url.startsWith('redis')) {
        const client = Redis.createClient(options.lock.url);

        const p = new Promise((resolve, reject) => {

            client.on('ready', () => {

                const leader = Lock.createLock(client, {
                    timeout: options.lock.ttl,
                    retries: 0,
                    delay: options.lock.retry
                });

                const isLeader = function () {

                    return new Promise((res, rej) => {

                        if (Lock.getAcquiredLocks().length > 0) {

                            leader.extend(options.lock.ttl, (err) => {

                                if (err) {
                                    return console.log(err.message);
                                } // 'Lock on app:lock has expired'
                            });


                            return res(true);
                        }

                        return leader.acquire(options.lock.key).then(() => res(true)).catch((err) => {

                            //console.log(err);
                            if (err) {
                                return res(false);
                            }
                        });
                    });
                };

                leader.isLeader = isLeader;
                server.decorate('server', 'leader', leader);
                return resolve();
            });
        });

        return p;
    }

};
