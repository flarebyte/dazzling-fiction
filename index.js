'use strict';
var Joi = require('joi');
var bluePromise = require("bluebird");
var fs = bluePromise.promisifyAll(require("fs"));
var marked = require('marked');
var _ = require('lodash');
var S = require('string');
var FICTION_SUFFIX = '.fiction.md';
var YES_NO = 'yes/no';

var fictionSchema = Joi.object().keys({
    scriptFolder: Joi.string(),
    script: Joi.string().min(4).required()
});
var scriptSchema = Joi.object().keys({
    text: Joi.string().min(20).required(),
});

var extractKey = function(value) {
    return S(value).between('**', '**');
};

var extractValue = function(value) {
    return S(value).chompLeft('**').between('**');
};


var asName = function(svalue) {
    if (svalue.contains(':')) {
        return svalue.trim().s;
    } else {
        return svalue.slugify().s;
    }
};

var FREQUENCY = ['never', 'rarely', 'occasionally', 'sometimes', 'often', 'usually', 'always'];

var isFrequencyWord = function(value) {
    return _.indexOf(FREQUENCY, value.trim().toLowerCase()) > -1;
};

var containsNumber = function(value) {
    return value.search(/[0-9]/) > -1;
};

var checkListType = function(list) {
    var first = _.first(list);
    var isNumber = /[0-9.]+/.test(first) && S(first).count('.') <= 1;
    return isNumber ? 'number' : 'string';
};

var checkMinMaxType = function(min) {
    var isInt = S(min).isNumeric();
    return isInt ? 'int' : 'float';
};

var extractBetween = function(value, from, to) {
    var hasFrom = S(value).contains(from) || S(from).length === 0;
    var hasTo = S(value).contains(to) || S(to).length === 0;
    if (!(hasFrom && hasTo)) {
        return {
            found: false,
            remain: value,
            extracted: []
        };
    }
    var extracted = S(value).between(from, to);
    var remain = S(value).replaceAll(from + extracted.s + to, '').s;
    return {
        found: true,
        remain: remain,
        extracted: extracted
    };


};
var extractRefs = function(value) {
    var ref = extractBetween(value, '`', '`');
    var r = ref;
    var extracted = [];
    while (ref.found) {
        extracted.push(asName(ref.extracted));
        r = {
            found: true,
            remain: ref.remain,
            extracted: extracted
        };
        ref = extractBetween(ref.remain, '`', '`');
    }
    return r;
};

var extractMinMax = function(value) {
    var hasNumber = containsNumber(value);
    if (!hasNumber) {
        return [];
    }
    var hasMinMax = S(value).contains(' to ');
    if (hasMinMax) {
        return [S(value).between('', ' to ').toFloat(), S(value).between(' to ').toFloat()];
    } else {
        return [S(value).toFloat(), S(value).toFloat()];
    }

};

var extractQuantity = function(value) {
    var hasQuantity = S(value).contains(' of ');
    if (!hasQuantity) {
        return {};
    }
    var qtyPart = S(value).between('', ' of ').s;
    var refs = extractRefs(qtyPart);
    if (refs.found) {
        return {
            refs: refs.extracted
        };
    }
    var hasMinMax = extractMinMax(qtyPart);
    if (!_.isEmpty(hasMinMax)) {
        return {
            type: 'int',
            min: hasMinMax[0],
            max: hasMinMax[1]
        };
    }


    return {};
};

var extractBoolean = function(value) {
    return S(value).contains(YES_NO);
};

var toNumber = function(value) {
    return S(value).toFloat();
};


var parseAttributeItem = function(value) {
    var remain = value;
    var r = {
        quantity: {
            type: 'int',
            min: 1,
            max: 1
        },
        value: {},
        raw: value

    };
    var list = extractBetween(remain, '*', '*');
    if (list.found) {
        var csvList = list.extracted.parseCSV();
        var listType = checkListType(csvList);
        if (listType === 'number') {
            csvList = _.map(csvList, toNumber);
        }
        r.value = {
            type: listType,
            list: csvList
        };
        remain = list.remain;
    }
    var quantity = extractQuantity(remain);
    if (!_.isEmpty(quantity)) {
        r.quantity = quantity;
        remain = S(remain).between(' of ').s;
    }
    var yesNo = extractBoolean(remain);
    if (yesNo) {
        r.value = {
            type: 'bool'
        };
        remain = S(remain).replaceAll(YES_NO, '').s;
    }
    var ref = extractBetween(remain, '`', '`');
    if (ref.found) {
        r.value = {
            ref: asName(ref.extracted)
        };
        remain = ref.remain;
    }
    var minMax = extractMinMax(remain);
    if (!_.isEmpty(minMax)) {
        r.value = {
            type: checkMinMaxType(list),
            min: minMax[0],
            max: minMax[1]
        };
    }

    return r;
};

var extractModelAttribute = function(value) {
    var attrValue = extractValue(value).parseCSV(';');
    Joi.assert(attrValue, Joi.array().min(1));
    var r = {};
    var hasFreqWord = isFrequencyWord(attrValue[0]);
    r.frequency = hasFreqWord ? attrValue[0].trim().toLowerCase() : 'always';
    var values = hasFreqWord ? _.drop(attrValue) : attrValue;
    r.values = _.map(values, parseAttributeItem);
    return r;

};

var md2obj = function(tokens) {
    var r = {
        title: "",
        imports: [],
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
        var isNotEmptyText = (token.type === 'text') && (!S(token.text).isEmpty());
        if (token.depth === 1) {
            r.title = token.text;
        } else if (token.depth === 2) {
            section = token.text.toLowerCase();
        } else if (token.depth === 3) {
            modelName = asName(S(token.text));
        } else {
            var isImport = (section === 'import') && isNotEmptyText;
            if (isImport) {
                r.imports.push(token.text);
                r.imports = _.uniq(r.imports);
            }
            var isWeighting = (section === 'weighting') && isNotEmptyText;
            if (isWeighting) {
                r.weighting[asName(extractKey(token.text))] = extractValue(token.text).parseCSV();
            }
            var isFrequency = (section === 'frequency') && isNotEmptyText;
            if (isFrequency) {
                var freqNames = extractKey(token.text).parseCSV();
                var freqValues = extractValue(token.text).parseCSV();
                for (var j = freqNames.length - 1; j >= 0; j--) {
                    r.frequency[freqNames[j]] = freqValues[j];
                }
            }

            var isRefs = (section === 'references') && isNotEmptyText;
            if (isRefs) {
                r.refs[asName(extractKey(token.text))] = parseAttributeItem(extractValue(token.text).s);
            }
            var isModelAttribute = (section === 'models') && isNotEmptyText;
            if (isModelAttribute) {

                _.set(r.models, modelName + '.' + asName(extractKey(token.text)), extractModelAttribute(token.text));
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

var concatArray = function(a, b) {
    return _.uniq(_.flattenDeep(a.concat(b)));
};

var ensureArray = function(value) {
    return _.isArray(value) ? value : [value];
};

module.exports = function(cfg) {
    Joi.assert(cfg, fictionSchema);


    var loadMdScript = function(scriptName) {
        var scriptPath = cfg.scriptFolder + scriptName + FICTION_SUFFIX;
        return fs.readFileAsync(scriptPath, 'utf8').then(text2obj);
    };

    var readImports = function(info) {
        var scriptPath = cfg.scriptFolder + info.scriptName + FICTION_SUFFIX;
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

    var readScriptImports = function(scriptName) {
        return readImports({
            scriptName: scriptName,
            parents: []
        }).reduce(concatArray).then(ensureArray);
    };

    var parseScript = function(params) {
        Joi.assert(params, scriptSchema);
        return readScriptImports(cfg.script).map(loadMdScript);
    };

    var fiction = {
        parseScript: parseScript,
        readScriptImports: readScriptImports
    };

    return fiction;

};