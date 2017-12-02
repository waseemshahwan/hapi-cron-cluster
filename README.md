# hapi-cron-cluster
A Hapi plugin to setup cron jobs that will call predefined server routes at specified times with leader election (cluster mode)

# Based and fork from
https://github.com/antonsamper/hapi-cron

## Requirements
The plugin is written in ES2016, please use **Node.js v4 or later**.
The plugin need to connect to mongo or redis (for leader election)


## Installation
Add `hapi-cron-cluster` as a dependency to your project:

```bash
npm i -S hapi-cron-cluster
# you're using NPM shortcuts to (i)nstall and (-S)ave the module as a dependency
```


## Usage
```javascript
const Hapi = require('hapi');
const Server = new Hapi.Server();
Server.connection();

Server.register({
    register: require('hapi-cron-cluster'),
    options: {
        lock: {
                url: 'mongodb://localhost/test',
                key: 'lockTest',
                ttl: 5000,
                retry: 1000
        },
        jobs: [{
            name: 'testcron',
            time: '*/10 * * * * *',
            timezone: 'Europe/London',
            request: {
                method: 'GET',
                url: '/test-url'
            },
            callback: (res) => {
              
                console.info('testcron has run!');
            }
        }]
    },
}, (err) => {

    if (err) {
        return console.error(err);
    }
    
    Server.start(() => {
    
        console.info(`Server started at ${ Server.info.uri }`);
    });
});
```

## Plugin Options
* `lock` - object that contains params for cluster leader election
* `lock.url` - mongodb url
* `lock.key` - group key for leader election
* `lock.ttl` - time to live when lock acquire
* `lock.retry` - wait time brefore retrying to get the lock
* `name` - [REQUIRED] - The name of the cron job. This can be anything but it must be unique.
* `time` - [REQUIRED] - A valid cron value. [See cron configuration](#cron-configuration)
* `timezone` - [REQUIRED] - A valid [timezone](https://momentjs.com/timezone/).
* `request` - [REQUIRED] - The request object containing the route url path. Other [options](https://hapijs.com/api#serverinjectoptions-callback) can also be passed into the request object.
    * `url` - [REQUIRED] - Route path to request
* `callback` - [OPTIONAL] - Callback function to run after the route has been requested. The function will contain the response from the request.

Please note that the plugin only works when the server contains exactly one connection.


## Cron configuration
This plugin uses the [node-cron](https://github.com/kelektiv/node-cron) module to setup the cron job. 


### Available Cron patterns:
```
Asterisk. E.g. *
Ranges. E.g. 1-3,5
Steps. E.g. */2
```
    

[Read up on cron patterns here](http://crontab.org). Note the examples in the link have five fields, and 1 minute as the finest granularity, but the node cron module allows six fields, with 1 second as the finest granularity.

### Cron Ranges
When specifying your cron values you'll need to make sure that your values fall within the ranges. For instance, some cron's use a 0-7 range for the day of week where both 0 and 7 represent Sunday. We do not.

 * Seconds: 0-59
 * Minutes: 0-59
 * Hours: 0-23
 * Day of Month: 1-31
 * Months: 0-11
 * Day of Week: 0-6
