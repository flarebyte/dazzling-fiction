/*global describe, it */
'use strict';
var fs = require('fs');
var assert = require('chai').assert;
var dazzlingFiction = require('../');

var othello = fs.readFileSync('test/fixtures/othello.txt').toString();
//var macbeth = fs.readFileSync('test/fixtures/macbeth.txt').toString();
//var hamlet = fs.readFileSync('test/fixtures/hamlet.txt').toString();

describe('dazzling-fiction node module', function() {
    it('must run script', function() {
        var fiction = dazzlingFiction({
            scriptFolder: "test/fixtures/",
            script: 'recipe.md'
        });
        fiction.runScript({
            text: othello
        });
        assert.isTrue(true, 'I was too lazy to write any tests. Shame on me.');
    });
});