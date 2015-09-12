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
		};
		var path = '/1/lists/' + listId + '/cards';
		makeRequest(path, 'POST', variables, callback);
	};

	function makeRequest(path, method, variables, callback)
	{
		variables.token = options.token;
		variables.key = options.key;
		var params = {
			host: 'trello.com',
			path: path + '?' + convert(variables),
			method: method,
			agent: false,
		};
		var request = https.request(params, function(response)
		{
			if (response.statusCode != 200)
			{
				return callback('Invalid response for ' + params.path + ': ' + response.statusCode);
			}
			var body = '';
			response.on('data', function(data)
			{
				body += String(data);
			});
			response.on('error', function(error)
			{
				callback('Could not listen to response: ' + error);
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
			callback('Could not connect to ' + path + ': ' + error);
		});
	}

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
		var path = '/1/lists/' + listId + '/cards';
		makeRequest(path, 'GET', {}, callback);
	};

	self.addComment = function(cardId, text, callback)
	{
		var variables = {text: text};
		var path = '/1/cards/' + cardId + '/actions/comments';
		makeRequest(path, 'POST', variables, callback);
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

