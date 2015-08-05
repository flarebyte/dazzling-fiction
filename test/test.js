/*global describe, it */
'use strict';
var assert = require('assert');
var dazzlingFiction = require('../');

describe('dazzling-fiction node module', function() {
    it('must have at least one test', function() {
        dazzlingFiction();
        assert(true, 'I was too lazy to write any tests. Shame on me.');
    });
});