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

exports.createCard = function(name, description, options, callback)
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
		path: '/1/lists/' + options.inProgress + '/cards?' + convert(variables),
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

function testCreateCard(callback)
{
	exports.createCard('name', 'description', credentials, function(error)
	{
		testing.check(error, 'Could not create board', callback);
		testing.success(callback);
	});
}

exports.readListCards = function(id, options, callback)
{
	var variables = {
		token: options.token,
		key: options.key,
	};
	var params = {
		host: 'trello.com',
		path: '/1/lists/' + id + '/cards?' + convert(variables),
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

function testReadListCards(callback)
{
	exports.readListCards(credentials.underReview, credentials, function(error, result)
	{
		testing.check(error, 'Could not read list', callback);
		log.info('Got %j', result);
		testing.success(callback);
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
	], 5000, callback);
};

// start server if invoked directly
if (__filename == process.argv[1])
{
	log = new Log('debug');
	exports.test(testing.show);
}

