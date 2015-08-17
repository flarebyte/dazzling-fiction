'use strict';
var Joi = require('joi');
var bluePromise = require("bluebird");
var fs = bluePromise.promisifyAll(require("fs"));
var marked = require('marked');
var _ = require('lodash');
var S = require('string');

var fictionSchema = Joi.object().keys({
    scriptFolder: Joi.string(),
    script: Joi.string().min(4).required()
});
var scriptSchema = Joi.object().keys({
    text: Joi.string().min(20).required(),
});

var extractKey = function(value) {
    return S(value).between('', ':').slugify().s;
};

var extractValue = function(value) {
    return S(value).between(':');
};

var FREQUENCY = ['never', 'rarely', 'occasionally', 'sometimes', 'often', 'usually', 'always'];

var isFrequencyWord = function(value) {
    return _.indexOf(FREQUENCY, value.toLowerCase()) > -1;
};

var extractModelAttribute = function(value) {
    var attrValue = extractValue(value).parseCSV(';');
    Joi.assert(attrValue, Joi.array().min(1));
    var r = {};
    var hasFreqWord = isFrequencyWord(attrValue[0]);
    r.frequency = hasFreqWord ? attrValue[0].toLowerCase() : 'always';
    var values = hasFreqWord ? _.drop(attrValue) : attrValue;
    r.values = values;
    return r;

};

var md2obj = function(tokens) {
    var r = {
        title: "",
        imports: {},
        weighting: {},
        frequency: {},
        models: {},
        refs: {}
    };
    var length = tokens.length;
    var section = "";
    var modelName = "";
    for (var i = 0; i < length; i++) {
        var token = tokens[i];
        if (token.depth === 1) {
            r.title = token.text;
        } else if (token.depth === 2) {
            section = token.text.toLowerCase();
        } else if (token.depth === 3) {
            modelName = S(token.text).slugify().s;
        } else {
            var isImport = (section === 'import') && (token.type === 'text') && (S(token.text).endsWith('.md'));
            if (isImport) {
                r.imports[token.text] = 'y';
            }
            var isWeighting = (section === 'weighting') && (token.type === 'text') && (S(token.text).contains(':'));
            if (isWeighting) {
                r.weighting[extractKey(token.text)] = extractValue(token.text).parseCSV();
            }
            var isFrequency = (section === 'frequency') && (token.type === 'text') && (S(token.text).contains(':'));
            if (isFrequency) {
                var freqNames = S(token.text).between('', ':').parseCSV();
                var freqValues = extractValue(token.text).parseCSV();
                for (var j = freqNames.length - 1; j >= 0; j--) {
                    r.frequency[freqNames[j]] = freqValues[j];
                }
            }

            var isRefs = (section === 'references') && (token.type === 'text') && (S(token.text).contains(':'));
            if (isRefs) {
                r.refs[extractKey(token.text)] = extractValue(token.text).s;
            }
            var isModelAttribute = (section === 'models') && (token.type === 'text') && (S(token.text).contains(':'));
            if (isModelAttribute) {

                _.set(r.models, modelName + '.' + extractKey(token.text), extractModelAttribute(token.text));
            }

        }
    }
    return r;
};

var text2obj = function(text) {
    var lexer = new marked.Lexer({});
    var m2Tokens = lexer.lex(text);
    return md2obj(m2Tokens);
};

var cleanImport = function(value) {
    return S(value).trimLeft().chompLeft('*').trim().s;
};

var isListItem = function(value) {
    return S(value).startsWith("*");
};
var text2Imports = function(text) {
    var hasImport = S(text).contains('## Import');
    if (!hasImport) {
        return [];
    } else {
        var lines = S(text).between('## Import', '##').lines();
        var onlyItems = _.filter(lines, isListItem);
        return _.map(onlyItems, cleanImport);
    }
};

var cloneAndMergeArray = function(a, b) {
    var aa = _.cloneDeep(a);
    aa.push(b);
    return aa;
};

module.exports = function(cfg) {
    Joi.assert(cfg, fictionSchema);

    var concatArray = function(a, b) {
        return a.concat(b);
    };
    // var loadMarkdownScript = function(scriptName) {
    //     console.log('loading ' + scriptName);
    //     var scriptPath = cfg.scriptFolder + scriptName;
    //     return fs.readFileAsync(scriptPath, 'utf8').then(text2obj).then(function(parentScript) {
    //         var scriptNames = _.keys(parentScript.imports);
    //         var hasImport = !_.isEmpty(scriptNames);
    //         var myscripts = hasImport ? scriptNames : [scriptName];
    //         console.log('>>||'+JSON.stringify(parentScript));
    //         return bluePromise.map(myscripts,loadMarkdownScript).reduce(concatArray,[]);
    //     });

    // };
    // 

    var loadMdScript = function(scriptName) {
        var scriptPath = cfg.scriptFolder + scriptName;
        return fs.readFileAsync(scriptPath, 'utf8').then(text2obj);
    };

    var loadMarkdownScripts = function(scriptList) {
        console.log('loading ' + scriptList);
        return bluePromise.map(scriptList, loadMdScript).reduce(concatArray, []);
    };

    var display = function(value) {
		console.log('Display ' + JSON.stringify(value, null, '    '));
    };


    var readImports = function(info) {
        console.log('Import ' + JSON.stringify(info, null, '    '));
        var scriptPath = cfg.scriptFolder + info.scriptName;
        return fs.readFileAsync(scriptPath, 'utf8').then(text2Imports).then(function(importList) {
            var childParents = cloneAndMergeArray(info.parents, info.scriptName);
            var childInfos = _.map(importList, function(ii) {
                return {
                    scriptName: ii,
                    parents: childParents
                };
            });

            return _.isEmpty(childInfos) ? childParents : bluePromise.map(childInfos, readImports);
        });

    };

    var runScript = function(params) {
        Joi.assert(params, scriptSchema);
        loadMarkdownScripts(['recipe.md']);
        return readImports({
            scriptName: cfg.script,
            parents: []
        }).reduce(concatArray).map(display);
    };

    var fiction = {
        runScript: runScript

    };

    return fiction;

};