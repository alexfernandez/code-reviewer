#!/usr/bin/env node
'use strict';

/**
 * Binary to run the main server.
 * (C) 2015 Alex Fernández.
 */

// requires
var stdio = require('stdio');
var Log = require('log');
var reviewServer = require('../lib/reviewServer');

// globals
var log = new Log('info');
var credentials = {};

// init
try
{
	credentials = require('../credentials.json');
}
catch(exception)
{
	log.info('Please enter default values in a file called credentials.json');
}
var options = stdio.getopt({
	token: {key: 't', args: 1, description: 'Consumer token for Trello'},
	key: {key: 'k', args: 1, description: 'Key for Trello'},
	secret: {key: 's', args: 1, description: 'Secret value to access the server'},
	port: {key: 'p', args: 1, description: 'Port to start the server', default: 7431},
	quiet: {key: 'q', description: 'Do not log any messages'},
	debug: {key: 'd', description: 'Log debug messages'},
});
credentials.overwriteWith(options);

reviewServer.start(credentials);

