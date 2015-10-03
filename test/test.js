/*global describe, it */
'use strict';
var fs = require('fs-extra');
var assert = require('chai').assert;
var S = require('string');
var dazzlingFiction = require('../');
var PORT = 8124;

var othello = fs.readFileSync('test/fixtures/othello.txt').toString();
//var macbeth = fs.readFileSync('test/fixtures/macbeth.txt').toString();
//var hamlet = fs.readFileSync('test/fixtures/hamlet.txt').toString();

var jsonRecipe = fs.readJsonSync('test/expected/recipe.json');
var jsonFamily = fs.readJsonSync('test/expected/family.json');
var jsonMergeRecipe = fs.readJsonSync('test/expected/merge-recipe.json');
var jsonMergeFamily = fs.readJsonSync('test/expected/merge-family.json');

var listServerOff = true;
var forceRecipe = false;
var forceFamily = false;

var createRecipeFict = function() {
    return dazzlingFiction({
        scriptFolder: "test/fixtures/",
        script: 'recipe'
    });

};

var runRecipe = function(done, id, query, force) {
    var fiction = createRecipeFict();
    var filename = 'test/expected/recipe-' + S(query).dasherize().s + '.json';
    if (!force) {
        var expectedJson = fs.readJsonSync(filename);
    }

    fiction.runScript({
        id: id,
        query: query,
        text: othello
    }).then(function(results) {

        if (force) {
            console.log("Creating file: " + filename);
            fs.writeJsonSync(filename, results);
        } else {
            assert.deepEqual(results, expectedJson);
        }
    }).then(function() {
        done();
    }).catch(function(e) {
        done(e);
    });

};

var runRecipeCsv = function(done, id, query, force) {
    var fiction = createRecipeFict();
    var filename = 'test/expected/recipe-' + S(query).dasherize().s + '.csv';
    if (!force) {
        var expectedCsvString = fs.readFileSync(filename, {
            'encoding': 'utf8'
        });
    }

    fiction.runScriptCsv({
        id: id,
        query: query,
        text: othello
    }).then(function(results) {

        if (force) {
            console.log("Creating file: " + filename);
            fs.writeFileSync(filename, results, {
                'encoding': 'utf8'
            });
        } else {
            assert.deepEqual(results, expectedCsvString);
        }
    }).then(function() {
        done();
    }).catch(function(e) {
        done(e);
    });

};

var createFamilyFict = function() {
    return dazzlingFiction({
        scriptFolder: "test/fixtures/",
        script: 'family',
        curies: [{
            startsWith: "web:",
            prefix: "http://localhost:" + PORT + "/",
            suffix: ".txt",
            contentType: "text/plain"

        }, {
            startsWith: "json-web:",
            prefix: "http://localhost:" + PORT + "/",
            suffix: ".json",
            contentType: "application/json"

        }, {
            startsWith: "here:",
            prefix: "test/fixtures/",
            suffix: ".txt",
            contentType: "text/plain"
        }, {
            startsWith: "json-file:",
            prefix: "test/fixtures/",
            suffix: ".json",
            contentType: "application/json"
        }]
    });

};

var runFamily = function(done, id, query, force) {
    if (listServerOff) {
        done();
        return;
    }
    
    var fiction = createFamilyFict();
    var filename = 'test/expected/family-' + S(query).dasherize().s + '.json';
    if (!force) {
        var expectedJson = fs.readJsonSync(filename);
    }

    fiction.runScript({
        id: id,
        query: query,
        text: othello
    }).then(function(results) {

        if (force) {
            console.log("Creating file: " + filename);
            fs.writeJsonSync(filename, results);
        } else {
            assert.deepEqual(results, expectedJson);
        }
    }).then(function() {
        done();
    }).catch(function(e) {
        done(e);
    });

};

describe('dazzling-fiction node module', function() {
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

    it('must read empty imports from script', function(done) {
        var fiction = dazzlingFiction({
            scriptFolder: "test/fixtures/",
            script: 'family'
        });
        fiction.readScriptImports('family').then(function(results) {
            assert.equal(results[0], 'family');
        }).then(function() {
            done();
        }).catch(function(e) {
            done(e);
        });
    });

    it('must parse the recipe script', function(done) {
        var fiction = dazzlingFiction({
            scriptFolder: "test/fixtures/",
            script: 'recipe'
        });
        fiction._parseScript().then(function(results) {
            assert.lengthOf(results, 5);
            assert.equal(results[0].title, 'Recipe');
            assert.equal(results[1].title, 'Basic');
            assert.equal(results[2].title, 'Super Basic');
            assert.equal(results[3].title, 'Side Basic');
            assert.equal(results[4].title, 'Second Basic');
            var recipe = results[0];
            assert.deepEqual(recipe.imports, ['basic', 'side-basic', 'second-basic']);
            assert.deepEqual(recipe.weighting.experimental, ['1', '2', '4', '8', '16']);
            assert.equal(recipe.frequency.never, 0, 'Never');
            if (forceRecipe) {
                fs.writeJsonSync('test/expected/recipe.json', results[0]);
            } else {
                assert.deepEqual(results[0], jsonRecipe);
            }


        }).then(function() {
            done();
        }).catch(function(e) {
            done(e);
        });

    });

    it('must parse and merge the recipe script', function(done) {
        var fiction = dazzlingFiction({
            scriptFolder: "test/fixtures/",
            script: 'recipe'
        });
        fiction._parseAndMergeScript().then(function(results) {
            assert.deepEqual(results.weighting.experimental, ['1', '2', '4', '8', '16']);
            assert.deepEqual(results.weighting.popular, ['1', '2', '3', '5', '8', '13', '21', '20', '13', '8', '5', '3', '3', '1']);
            assert.deepEqual(results.weighting.fibo, ['1', '2', '3', '5', '8', '13']);
            assert.deepEqual(results.weighting.side, ['1', '2', '9', '5', '8', '13']);
            assert.deepEqual(results.weighting.second, ['2', '2', '2', '5', '8', '13']);
            assert.deepEqual(results.frequency, {
                "always": 6,
                "max": 6,
                "usually": 5,
                "often": 4,
                "sometimes": 3,
                "occasionally": 2,
                "rarely": 1,
                "never": 0
            });
            if (forceRecipe) {
                fs.writeJsonSync('test/expected/merge-recipe.json', results);
            } else {
                assert.deepEqual(results, jsonMergeRecipe);
            }

        }).then(function() {
            done();
        }).catch(function(e) {
            done(e);
        });

    });


    it('must parse the family script', function(done) {
        var fiction = dazzlingFiction({
            scriptFolder: "test/fixtures/",
            script: 'family'
        });
        fiction._parseScript().then(function(results) {
            assert.lengthOf(results, 1);
            assert.equal(results[0].title, 'Family Tree');
            if (forceFamily) {
                console.log('writing family.json');
                fs.writeJsonSync('test/expected/family.json', results[0]);
            } else {
                assert.deepEqual(results[0], jsonFamily);
            }

        }).then(function() {
            done();
        }).catch(function(e) {
            done(e);
        });

    });


    it('must parse and merge the family script', function(done) {
        var fiction = dazzlingFiction({
            scriptFolder: "test/fixtures/",
            script: 'family'
        });
        fiction._parseAndMergeScript().then(function(results) {
            if (forceFamily) {
                console.log('writing merge-family.json');
                fs.writeJsonSync('test/expected/merge-family.json', results);
            } else {
                assert.deepEqual(results, jsonMergeFamily);
                assert.deepEqual(results, jsonFamily);
            }
        }).then(function() {
            done();
        }).catch(function(e) {
            done(e);
        });

    });

    it('must run the recipe script for Dessert', function(done) {
        runRecipe(done, "m", "2 of `Dessert`", false);
    });

    it('must run the recipe script for Sauce', function(done) {
        runRecipe(done, "m", "2 of `Sauce`", false);
    });

    it('must run the recipe script for Meat', function(done) {
        runRecipe(done, "m", "2 of `Meat`", false);
    });

    it('must run the recipe csv script for Meat ', function(done) {
        runRecipeCsv(done, "m", "2 of `Meat`", false);
    });


    it('must run the recipe script for Vegetable', function(done) {
        runRecipe(done, "m", "1 of `Vegetable`", false);
    });

    it('must run the recipe csv script for Vegetable', function(done) {
        runRecipeCsv(done, "m", "3 to 5 of `Vegetable`", false);
    });

    it('must run the recipe script for Meal', function(done) {
        runRecipe(done, "m", "2 of `Meal`", false);
    });

    it('must run the recipe csv script for Meal', function(done) {
        runRecipeCsv(done, "m", "2 of `Meal`", false);
    });

    it('must run the recipe script for Secret spice', function(done) {
        runRecipe(done, "m", "2 of `Secret spice`", false);
    });

    //Family scripts
    it('must run the family script for female', function(done) {
        runFamily(done, "f", "2 of `female`", false);
    });

    it('must run the family script for male', function(done) {
        runFamily(done, "f", "2 of `male`", false);
    });

    it('must run the family script for parent', function(done) {
        runFamily(done, "f", "3 of `parent`", false);
    });


});