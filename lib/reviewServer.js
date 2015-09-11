/*jshint camelcase: false */
'use strict';

/**
 * Review server that listens to GitHub notifications.
 * (C) 2015 Alex Fernández.
 */


// requires
require('prototypes');
var Log = require('log');
var http = require('http');
var testing = require('testing');
var trello = require('./trello.js');

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
		var json;
		try
		{
			json = JSON.parse(body);
		}
		catch(exception)
		{
			log.info('Invalid message received: %s', body.substring(0, 20));
			return;
		}
		console.log('Got message to %s: %s', url, JSON.stringify(json, null, '\t'));
		analyze(json);
	}

	function analyze(info)
	{
		if (!info.action || !info.repository || !info.pull_request)
		{
			return log.info('Missing action/repository/pull_request in message: %s / %s / %s', info.action, info.repository, info.pull_request);
		}
		var action = info.action;
		var repoName = info.repository.name;
		var title;
		log.info('Received action %s for [%s]', action, repoName);
		if (action == 'created')
		{
			// create comment in card
			var sender = info.sender.login;
			var body = info.comment.body;
			title = '[' + repoName + '] ' + info.issue.title;
			return log.info('Comment created by %s on %s: %s', sender, title, body);
		}
		title = '[' + repoName + '] ' + info.pull_request.title;
		var description = info.pull_request.body;
		var username = info.pull_request.user.login;
		if (action == 'opened')
		{
			trello.createCard(title, description, options, function(error)
			{
				if (error)
				{
					return log.error('Could not create card: %s', error);
				}
				return log.info('Created card for %s by %s', title, username);
			});
		}
		else if (action == 'closed')
		{
		}
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

