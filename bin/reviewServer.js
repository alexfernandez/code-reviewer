#!/usr/bin/env node
'use strict';

/**
 * Binary to run the main server.
 * (C) 2015 Alex Fernández.
 */

// requires
var stdio = require('stdio');
var reviewServer = require('../lib/reviewServer');

// init
var options = stdio.getopt({
	token: {key: 't', args: 1, mandatory: true, description: 'Consumer token for Trello'},
	key: {key: 'k', args: 1, mandatory: true, description: 'Key for Trello'},
	secret: {key: 's', args: 1, mandatory: true, description: 'Secret value to access the server'},
	port: {key: 'p', args: 1, description: 'Port to start the server', default: 6003},
	quiet: {key: 'q', description: 'Do not log any messages'},
	debug: {key: 'd', description: 'Log debug messages'},
});

reviewServer.start(options);

