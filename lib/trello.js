'use strict';

/**
 * Trello connector.
 * (C) 2015 Alex Fernández.
 */


// requires
require('prototypes');
var Log = require('log');
var async = require('async');
var https = require('https');
var testing = require('testing');
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
				var json;
				try
				{
					json = JSON.parse(body);
				}
				catch(exception)
				{
					return callback('Could not parse JSON: ' + exception);
				}
				return callback(null, json);
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

	self.findCard = function(name, callback)
	{
		readBoard(function(error, board)
		{
			if (error)
			{
				return callback(error);
			}
			var tasks = board.lists.map(function(list)
			{
				return function(callback)
				{
					self.readListCards(list.id, callback);
				};
			});
			async.series(tasks, function(error, listCards)
			{
				if (error)
				{
					return callback(error);
				}
				var matchingLists = listCards.map(function(cards)
				{
					var matchingCards = cards.filter(function(card)
					{
						return card.name == name;
					});
					if (matchingCards.length)
					{
						return matchingCards[0];
					}
					return null;
				}).filter(function(matchingCard)
				{
					return matchingCard;
				});
				return callback(null, matchingLists[0]);
			});
		});
	};

	function readBoard(callback)
	{
		var variables = {lists: 'all'};
		var path = '/1/board/' + options.board;
		makeRequest(path, 'GET', variables, callback);
	}

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
		testing.check(error, 'Could not create card', callback);
		testing.success(callback);
	});
}

function testReadListCards(callback)
{
	var board = new exports.Board(credentials);
	board.readListCards(credentials.inProgress, function(error, cards)
	{
		testing.check(error, 'Could not read cards', callback);
		testing.assert(cards.length, 'No cards', callback);
		testing.success(callback);
	});
}

function testFindCard(callback)
{
	var board = new exports.Board(credentials);
	board.findCard('name', function(error, card)
	{
		testing.check(error, 'Could not find card', callback);
		testing.assert(card.name == 'name', 'Invalid card name', callback);
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
		testFindCard,
		testAddComment,
	], 50000, callback);
};

// start server if invoked directly
if (__filename == process.argv[1])
{
	log = new Log('debug');
	exports.test(testing.show);
}

