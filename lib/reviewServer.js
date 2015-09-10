'use strict';

/**
 * Review server that listens to GitHub notifications.
 * (C) 2015 Alex Fernández.
 */


// requires
require('prototypes');
var testing = require('testing');
var http = require('http');
var Log = require('log');

// globals
var log = new Log('info');

// constants


/**
 * A review server, with the given options, see below on start().
 */
function ReviewServer(options)
{
	// self-reference
	var self = this;

	// init
	if (options.quiet)
	{
		log.level = 'notice';
	}
	if (options.debug)
	{
		log.level = 'debug';
	}
	
	/**
	 * Start the server.
	 * An optional callback will be called after the server has started.
	 */
	self.start = function(callback)
	{
		var server = http.createServer(listen);
		server.on('error', function(error)
		{
			if (error.code == 'EADDRINUSE')
			{
				return callback('Port ' + options.port + ' in use, please free it and retry again');
			}
			return callback('Could not start server on port ' + options.port + ': ' + error);
		});
		server.listen(options.port, function()
		{
			log.info('Listening on port %s', options.port);
			if (callback)
			{
				callback();
			}
		});
		return server;
	};

	/**
	 * Listen to an incoming request.
	 */
	function listen(request, response)
	{
		var body = '';
		request.on('data', function(data)
		{
			body += data.toString();
		});
		request.on('error', function(error)
		{
			log.error('Could not listen to request: %s', error);
		});
		request.on('end', function()
		{
			end(request.url, body, response);
		});
	}

	/**
	 * End the response now.
	 */
	function end(url, body, response)
	{
		if (!url.contains(options.secret))
		{
			var code = options.error || 500;
			response.writeHead(code);
			response.end('ERROR');
			return;
		}
		response.end('OK');
	}
}

/**
 * Start a review server. Options can contain:
 *	- token: consumer token for Trello.
 *	- key: app key for Trello.
 *	- secret: part of the URL to invoke.
 *	- port: the port to use.
 *	- quiet: do not log messages.
 *	- debug: log debug messages.
 * Other arguments:
 *	- callback: invoked after the server has started.
 */
exports.start = function(options, callback)
{
	var server = new ReviewServer(options);
	return server.start(callback);
};

function testStartServer(callback)
{
	var options = {
		port: 10530,
	};
	var server = exports.start(options, function(error)
	{
		testing.check(error, 'Could not start server', callback);
		server.close(function(error)
		{
			testing.check(error, 'Could not stop server', callback);
			testing.success(callback);
		});
	});
}

/**
 * Run the tests.
 */
exports.test = function(callback)
{
	testing.run([testStartServer], 5000, callback);
};

// start server if invoked directly
if (__filename == process.argv[1])
{
	exports.test(testing.show);
}

