'use strict';

/**
 * Trello connector.
 * (C) 2015 Alex Fernández.
 */


// requires
require('prototypes');
var testing = require('testing');
var https = require('https');
var Log = require('log');
var credentials = require('../credentials.json');

// globals
var log = new Log('info');

// constants

exports.Board = function(options)
{
	// self-reference
	var self = this;

	self.createCard = function(name, description, listId, callback)
	{
		var variables = {
			name: name,
			description: description,
			labels: 'orange',
			token: options.token,
			key: options.key,
		};
		var params = {
			host: 'trello.com',
			path: '/1/lists/' + listId + '/cards?' + convert(variables),
			method: 'POST',
			agent: false,
		};
		var request = https.request(params, function(response)
		{
			log.info('Received response to %s with status code: %s', params.path, response.statusCode);
			return callback(null);
		});
		request.end();
		request.on('error', function(error)
		{
			callback('Could not create card: ' + error);
		});
	};

	function convert(map)
	{
		var results = [];
		for (var key in map)
		{
			results.push(key + '=' + encodeURIComponent(map[key]));
		}
		return results.join('&');
	}

	self.readListCards = function(listId, callback)
	{
		var variables = {
			token: options.token,
			key: options.key,
		};
		var params = {
			host: 'trello.com',
			path: '/1/lists/' + listId + '/cards?' + convert(variables),
			method: 'GET',
			agent: false,
		};
		var request = https.request(params, function(response)
		{
			log.info('Received response to %s with status code: %s', params.path, response.statusCode);
			var body = '';
			response.on('data', function(data)
			{
				body += String(data);
			});
			response.on('error', function(error)
			{
				callback('Could not listen to response: %s', error);
			});
			response.on('end', function()
			{
				try
				{
					var json = JSON.parse(body);
					return callback(null, json);
				}
				catch(exception)
				{
					return callback('Could not parse JSON: ' + exception);
				}
			});
		});
		request.end();
		request.on('error', function(error)
		{
			callback('Could not read list: ' + error);
		});
	};

	self.addComment = function(cardId, text, callback)
	{
		var variables = {
			text: text,
			token: options.token,
			key: options.key,
		};
		var params = {
			host: 'trello.com',
			path: '/1/cards/' + cardId + '/actions/comments?' + convert(variables),
			method: 'POST',
			agent: false,
		};
		var request = https.request(params, function(response)
		{
			log.info('Received response to %s with status code: %s', params.path, response.statusCode);
			return callback(null);
		});
		request.end();
		request.on('error', function(error)
		{
			callback('Could not create card: ' + error);
		});
	};
};

function testCreateCard(callback)
{
	var board = new exports.Board(credentials);
	board.createCard('name', 'description', credentials.inProgress, function(error)
	{
		testing.check(error, 'Could not create board', callback);
		testing.success(callback);
	});
}

function testReadListCards(callback)
{
	var board = new exports.Board(credentials);
	board.readListCards(credentials.underReview, function(error, result)
	{
		testing.check(error, 'Could not read list', callback);
		log.info('Got %j', result);
		testing.success(callback);
	});
}

function testAddComment(callback)
{
	var board = new exports.Board(credentials);
	board.readListCards(credentials.inProgress, function(error, cards)
	{
		testing.check(error, 'Could not read list', callback);
		testing.assert(cards.length, 'No cards in inProgress', callback);
		board.addComment(cards[0].id, 'Test comment.', function(error)
		{
			testing.check(error, 'Could not add comment', callback);
			testing.success(callback);
		});
	});

}

/**
 * Run the tests.
 */
exports.test = function(callback)
{
	testing.run([
		testCreateCard,
		testReadListCards,
		testAddComment,
	], 5000, callback);
};

// start server if invoked directly
if (__filename == process.argv[1])
{
	log = new Log('debug');
	exports.test(testing.show);
}

