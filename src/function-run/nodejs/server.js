'use strict';

const fs = require('fs');
const process = require('process');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');

// Command line opts
const argv = require('minimist')(process.argv.slice(1));
if (!argv.codepath || !argv.port) {
    console.error("Need --codepath and --port");
    process.exit(1);
}

// User function.  Starts out undefined.
let userFunction;

//
// Specialize this server to a given user function.  The user function
// is read from argv.codepath; it's expected to be placed there by the
// fission runtime.
//
function specialize(req, res) {
    // Make sure we're a generic container.  (No reuse of containers.
    // Once specialized, the container remains specialized.)
    if (userFunction) {
        res.status(400).send("Not a generic container");
        return;
    }

    // Read and load the code. It's placed there securely by the fission runtime.
    try {
        var startTime = process.hrtime();
        userFunction = require(argv.codepath);
        var elapsed = process.hrtime(startTime);
        console.log(`user code loaded in ${elapsed[0]}sec ${elapsed[1]/1000000}ms`);
    } catch(e) {
        console.error(`user code load error: ${e}`);
        res.status(500).send(JSON.stringify(e));
        return;
    }
    res.status(202).send();
}


app.use(bodyParser.json());
app.post('/specialize', specialize);

// Generic route -- all http requests go to the user function.
app.all('/', function (req, res) {
    if (!userFunction) {
        res.status(500).send("Generic container: no requests supported");
        return;
    }
    const context = {
        request: req,
        response: res
        // TODO: context should also have: URL template params, query string, ...anything else?
    };
    function callback(status, body, headers) {
        if (!status)
            return;
        if (headers) {
            for (let name of Object.keys(headers)) {
                res.set(name, headers[name]);
            }
        }
        res.status(status).send(body);
    }
    userFunction(context, callback);
});

app.listen(argv.port);
