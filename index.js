'use strict';

/**
 * Code reviewer: Helps code reviews on GitHub pull requests using a Trello board.
 * (C) 2015 Alex Fernández.
 */


// requires
require('prototypes');
var reviewServer = require('./lib/reviewServer.js');


exports.start = reviewServer.start;

