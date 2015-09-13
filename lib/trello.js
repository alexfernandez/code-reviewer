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
			desc: description,
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

	self.readList = function(listId, callback)
	{
		var path = '/1/lists/' + listId;
		makeRequest(path, 'GET', {cards: 'all'}, function(error, list)
		{
			if (error)
			{
				return callback(error);
			}
			list.cards.filter(function(card)
			{
				return card.closed;
			});
			return callback(null, list);
		});
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
					self.readList(list.id, callback);
				};
			});
			async.series(tasks, function(error, lists)
			{
				if (error)
				{
					return callback(error);
				}
				var matchingCards = lists.map(function(list)
				{
					var matchingInList = list.cards.filter(function(card)
					{
						return card.name.startsWith(name);
					});
					if (matchingInList.length)
					{
						return matchingInList[0];
					}
					return null;
				}).filter(function(matchingCard)
				{
					return matchingCard;
				});
				return callback(null, matchingCards[0]);
			});
		});
	};

	/**
	 * Returns an array of comments for a card, including text and author.
	 */
	self.readComments = function(cardId, callback)
	{
		var path = '/1/cards/' + cardId + '/actions';
		makeRequest(path, 'GET', {filter: 'commentCard'}, function(error, results)
		{
			if (error)
			{
				return error;
			}
			var comments = results.map(function(commentCard)
			{
				return {
					text: commentCard.data.text,
					date: commentCard.date,
					author: commentCard.memberCreator,
				};
			});
			callback(null, comments);
		});
	};

	self.moveCard = function(title, listId, callback)
	{
		if (title.length == 24 && !title.contains('['))
		{
			return moveCardId(title, listId, callback);
		}
		self.findCard(title, function(error, card)
		{
			if (error)
			{
				return callback(error);
			}
			if (!card)
			{
				return callback('Could not find card ' + title);
			}
			moveCardId(card.id, listId, callback);
		});
	};

	function moveCardId(cardId, listId, callback)
	{
		var path = '/1/cards/' + cardId + '/idList';
		makeRequest(path, 'PUT', {value: listId}, callback);
	}

	function readBoard(callback)
	{
		var path = '/1/board/' + options.board;
		makeRequest(path, 'GET', {lists: 'all'}, callback);
	}

	self.modifyCard = function(cardId, variables, callback)
	{
		var path = '/1/cards/' + cardId;
		makeRequest(path, 'PUT', variables, callback);
	};

	self.addComment = function(cardId, text, callback)
	{
		var variables = {text: text};
		var path = '/1/cards/' + cardId + '/actions/comments';
		makeRequest(path, 'POST', variables, callback);
	};
};

function testCreateMoveCard(callback)
{
	var board = new exports.Board(credentials);
	var description = 'This is a sample card.\n\nIn no way related to this [repo]' +
		'(https://github.com/alexfernandez/trello-reviewer).\n\nEnjoy!';
	board.createCard('name', description, credentials.inProgress, function(error)
	{
		testing.check(error, 'Could not create card', callback);
		board.moveCard('name', credentials.cancelled, function(error)
		{
			testing.check(error, 'Could not move card', callback);
			testing.success(callback);
		});
	});
}

function testReadList(callback)
{
	var board = new exports.Board(credentials);
	board.readList(credentials.inProgress, function(error, list)
	{
		testing.check(error, 'Could not read cards', callback);
		testing.assert(list.cards.length, 'No cards', callback);
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
		board.modifyCard(card.id, {name: 'newName'}, function(error)
		{
			testing.check(error, 'Could not rename card', callback);
			testing.success(callback);
		});
	});
}

function testAddReadComment(callback)
{
	var board = new exports.Board(credentials);
	board.readList(credentials.inProgress, function(error, list)
	{
		testing.check(error, 'Could not read list', callback);
		testing.assert(list.cards.length, 'No cards in inProgress', callback);
		var cardId = list.cards[0].id;
		var then = Date.now();
		var text = 'Test comment';
		board.addComment(cardId, text, function(error)
		{
			testing.check(error, 'Could not add comment', callback);
			board.readComments(cardId, function(error, comments)
			{
				testing.check(error, 'Could not read comments', callback);
				testing.assert(comments.length >= 1, 'Not enough comments', callback);
				testing.assertEquals(comments[0].text, text, 'Invalid comment text', callback);
				var date = new Date(comments[0].date);
				var elapsed = date.getTime() - then;
				testing.assert(elapsed < 10000, 'Too much time since last comment', callback);
				testing.success(callback);
			});
		});
	});

}

/**
 * Run the tests.
 */
exports.test = function(callback)
{
	testing.run([
		testCreateMoveCard,
		testReadList,
		testFindCard,
		testAddReadComment,
	], 50000, callback);
};

// start server if invoked directly
if (__filename == process.argv[1])
{
	log = new Log('debug');
	exports.test(testing.show);
}

