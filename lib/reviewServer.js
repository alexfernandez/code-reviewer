/*jshint camelcase: false */
'use strict';

/**
 * Review server that listens to GitHub notifications.
 * (C) 2015 Alex Fernández.
 */


// requires
require('prototypes');
var fs = require('fs');
var Log = require('log');
var http = require('http');
var testing = require('testing');
var trello = require('./trello.js');

// globals
var log = new Log('info');

// constants
var FUNCTIONS = {
	created: 'createComment',
	opened: 'openPullRequest',
	closed: 'closePullRequest',
	reopened: 'reopenPullRequest',
};


/**
 * A review server, with the given options, see below on start().
 */
function ReviewServer(options)
{
	// self-reference
	var self = this;

	// attributes
	var board = new trello.Board(options);

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
		log.debug('Got message to %s: %s', url, JSON.stringify(json, null, '\t'));
		analyze(json);
	}

	function analyze(info)
	{
		if (!info.action || !info.repository)
		{
			return log.info('Missing action/repository in message: %s / %s', info.action, info.repository);
		}
		var operationName = FUNCTIONS[info.action];
		if (!operationName)
		{
			return handleUnknownAction(info);
		}
		var operation = self[operationName];
		operation(info);
	}

	self.createComment = function(info)
	{
		// create comment in card
		var repoName = info.repository.name;
		var sender = info.sender.login;
		var title = '[' + repoName + '] ' + info.issue.title;
		var body = info.sender.login + ': ' + info.comment.body + '\n\n[View on GitHub](' + info.comment.html_url + ')';
		if (!body.contains('+1') && !body.contains('-1'))
		{
			return log.info('Comment created by %s on %s: %s', sender, title, body);
		}
		board.findCard(title, function(error, card)
		{
			if (error)
			{
				return log.error('Could not find card %s: %s', title, error);
			}
			if (!card)
			{
				return log.info('Could not find card for %s', title);
			}
			board.addComment(card.id, body, function(error)
			{
				if (error)
				{
					return log.error('Could not add comment to %s: %s', title, error);
				}
				log.info('Comment %s added to %s', body, title);
			});
		});
	};

	self.openPullRequest = function(info)
	{
		var title = getTitle(info);
		if (!title)
		{
			return;
		}
		var link = '[View on GitHub](' + info.pull_request.html_url + ')\n\n';
		var description = link + info.pull_request.body;
		var username = info.pull_request.user.login;
		board.createCard(title, description, options.inProgress, function(error)
		{
			if (error)
			{
				return log.error('Could not create card: %s', error);
			}
			return log.info('Created card for %s by %s', title, username);
		});
	};

	function getTitle(info)
	{
		if (!info.pull_request)
		{
			return log.info('Missing pull request to open');
		}
		var repoName = info.repository.name;
		return '[' + repoName + '] ' + info.pull_request.title;
	}

	self.closePullRequest = function(info)
	{
		var title = getTitle(info);
		if (!title)
		{
			return;
		}
		var destination = 'cancelled';
		if (info.pull_request.merged)
		{
			destination = 'merged';
		}
		var listId = options[destination];
		board.moveCard(title, listId, function(error)
		{
			if (error)
			{
				return log.error('Could not move closed card %s to %s: %s', title, destination, error);
			}
			return log.info('Moved card for %s to %s', title, destination);
		});
	};

	self.reopenPullRequest = function(info)
	{
		var title = getTitle(info);
		if (!title)
		{
			return;
		}
		board.moveCard(title, options.inProgress, function(error)
		{
			if (error)
			{
				return log.error('Could not move reopened card %s: %s', title, error);
			}
			return log.info('Moved card for %s to in progress', title);
		});
	};

	function handleUnknownAction(info)
	{
		var filename = __dirname + '/../samples/' + info.action + '-sample.json';
		fs.writeFile(filename, JSON.stringify(info, null, '\t'), function(error)
		{
			if (error)
			{
				return log.error('Could not write action %s to file %s: %s', info.action, filename, error);
			}
			log.info('Received unknown action %s, written to %s', info.action, filename);
		});
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

