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
	var options = credentials;
	exports.createCard('name', 'description', options, function(error)
	{
		testing.check(error, 'Could not create board', callback);
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
	], 5000, callback);
};

// start server if invoked directly
if (__filename == process.argv[1])
{
	exports.test(testing.show);
}

