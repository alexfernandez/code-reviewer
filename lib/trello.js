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
var testBoard;

// constants
var DEFAULT_NAMES = {
	inProgress: 'In Progress',
	underReview: 'Under Review',
	reviewed: 'Reviewed',
	merged: 'Merged',
	cancelled: 'Cancelled',
	blocked: 'Blocked',
};


exports.Board = function(options)
{
	// self-reference
	var self = this;

	// attributes
	var lists = {};


	/**
	 * Looks for the needed lists by key, then by name.
	 * If not found, creates them.
	 */
	self.init = function(callback)
	{
		readBoard(function(error, board)
		{
			var tasks = {};
			for (var key in DEFAULT_NAMES)
			{
				var defaultName = DEFAULT_NAMES[key];
				tasks[key] = getListMaker(key, defaultName, board);
			}
			async.series(tasks, function(error, results)
			{
				if (error)
				{
					return callback(error);
				}
				lists = results;
				return callback(null);
			});
		});
	};

	function readBoard(callback)
	{
		var path = '/1/board/' + options.board;
		makeRequest(path, 'GET', {lists: 'all'}, callback);
	}

	function getListMaker(key, defaultName, board)
	{
		return function(callback)
		{
			var id = options[key];
			if (id)
			{
				var byId = board.lists.filter(function(list)
				{
					return list.id == id;
				});
				if (!byId.length)
				{
					return callback('List ' + key + ' with id ' + id + ' in credentials.json not found');
				}
			}
			else
			{
				var byName = board.lists.filter(function(list)
				{
					return list.name == defaultName;
				});
				if (!byName.length)
				{
					return createList(defaultName, callback);
				}
				if (byName.length > 1)
				{
					log.warning('Several lists with name ' + defaultName + ' found; picking the first');
				}
				id = byName[0].id;
			}
			return self.readList(id, callback);
		};
	}

	function createList(name, callback)
	{
		var variables = {
			name: name,
			idBoard: options.board,
		};
		var path = '/1/lists';
		makeRequest(path, 'POSTS', variables, callback);
	}

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

	self.createCard = function(name, description, listId, callback)
	{
		var variables = {
			name: name,
			desc: description,
		};
		var path = '/1/lists/' + listId + '/cards';
		makeRequest(path, 'POST', variables, callback);
	};

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

	self.findCard = function(name)
	{
		var matchingCards = Object.values(lists).map(function(list)
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
		return matchingCards[0];
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
		var card = self.findCard(title);
		if (!card)
		{
			return callback('Could not find card ' + title);
		}
		moveCardId(card.id, listId, callback);
	};

	function moveCardId(cardId, listId, callback)
	{
		var path = '/1/cards/' + cardId + '/idList';
		makeRequest(path, 'PUT', {value: listId}, callback);
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

function testInitBoard(callback)
{
	testBoard = new exports.Board(credentials);
	testBoard.init(function(error)
	{
		testing.check(error, 'Could not init board', callback);
		testing.success(callback);
	});
}

function testCreateMoveCard(callback)
{
	var description = 'This is a sample card.\n\nIn no way related to this [repo]' +
		'(https://github.com/alexfernandez/trello-reviewer).\n\nEnjoy!';
	testBoard.createCard('name', description, credentials.inProgress, function(error)
	{
		testing.check(error, 'Could not create card', callback);
		testBoard.moveCard('name', credentials.cancelled, function(error)
		{
			testing.check(error, 'Could not move card', callback);
			testing.success(callback);
		});
	});
}

function testReadList(callback)
{
	testBoard.readList(credentials.inProgress, function(error, list)
	{
		testing.check(error, 'Could not read cards', callback);
		testing.assert(list.cards.length, 'No cards', callback);
		testing.success(callback);
	});
}

function testFindCard(callback)
{
	var card = testBoard.findCard('name');
	testing.assert(card.name == 'name', 'Invalid card name', callback);
	testBoard.modifyCard(card.id, {name: 'newName'}, function(error)
	{
		testing.check(error, 'Could not rename card', callback);
		testing.success(callback);
	});
}

function testAddReadComment(callback)
{
	testBoard.readList(credentials.inProgress, function(error, list)
	{
		testing.check(error, 'Could not read list', callback);
		testing.assert(list.cards.length, 'No cards in inProgress', callback);
		var cardId = list.cards[0].id;
		var then = Date.now();
		var text = 'Test comment';
		testBoard.addComment(cardId, text, function(error)
		{
			testing.check(error, 'Could not add comment', callback);
			testBoard.readComments(cardId, function(error, comments)
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
		testInitBoard,
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

