'use strict';
var Joi = require('joi');
var fs = require('fs');
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


module.exports = function(cfg) {
    Joi.assert(cfg, fictionSchema);

    var loadMarkdownScript = function(scriptName) {
        var scriptContent = fs.readFileSync(cfg.scriptFolder + scriptName).toString();
        var lexer = new marked.Lexer({});
        var tokens = lexer.lex(scriptContent);
        return md2obj(tokens);
    };

    //var imports = {};
    //var weighting = {};
    //var frequency = {};
    var mainScript = loadMarkdownScript(cfg.script);

    var runScript = function(params) {
        Joi.assert(params, scriptSchema);

        console.log(JSON.stringify(mainScript, null, '    '));
    };

    var fiction = {
        runScript: runScript

    };

    return fiction;

};