/*global describe, it */
'use strict';
var fs = require('fs');
var assert = require('chai').assert;
var dazzlingFiction = require('../');

var othello = fs.readFileSync('test/fixtures/othello.txt').toString();
//var macbeth = fs.readFileSync('test/fixtures/macbeth.txt').toString();
//var hamlet = fs.readFileSync('test/fixtures/hamlet.txt').toString();

var display = function(value) {
    console.log('XDisplay: ' + JSON.stringify(value, null, '    ') + '/XDisplay');
};

describe('dazzling-fiction node module', function() {
    it('must parse the script', function(done) {
        var fiction = dazzlingFiction({
            scriptFolder: "test/fixtures/",
            script: 'recipe'
        });
        fiction.parseScript({
            text: othello
        }).then(function(results) {
            assert.lengthOf(results, 5);
            assert.equal(results[0].title, 'Recipe');
            assert.equal(results[1].title, 'Basic');
            assert.equal(results[2].title, 'Super Basic');
            assert.equal(results[3].title, 'Side Basic');
            assert.equal(results[4].title, 'Second Basic');
            var recipe = results[0];
            assert.deepEqual(recipe.imports,[ 'basic','side-basic','second-basic' ]);
            assert.deepEqual(recipe.weighting.experimental,[ '1', '2', '4', '8', '16' ]);
            assert.equal(recipe.frequency.Never,0,'Never');
            display(results);
        }).then(function() {
            done();
        }).catch(function(e) {
            done(e);
        });

    });

    it('must read imports from script', function(done) {
        var fiction = dazzlingFiction({
            scriptFolder: "test/fixtures/",
            script: 'recipe'
        });
        fiction.readScriptImports('recipe').then(function(results) {
            assert.equal(results[0], 'recipe');
            assert.equal(results[1], 'basic');
            assert.equal(results[2], 'super-basic');
            assert.equal(results[3], 'side-basic');
            assert.equal(results[4], 'second-basic');
        }).then(function() {
            done();
        }).catch(function(e) {
            done(e);
        });

    });

});