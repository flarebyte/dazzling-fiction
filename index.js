'use strict';
var Joi = require('joi');
var bluePromise = require("bluebird");
var fs = bluePromise.promisifyAll(require("fs"));
var marked = require('marked');
var _ = require('lodash');
var S = require('string');
var dazzlingChance = require('dazzling-chance');

var FICTION_SUFFIX = '.fiction.md';
var YES_NO = 'yes/no';
var TYPE_REF = "REF";
var TYPE_MODEL = "MODEL";
var TYPE_WEIGHTING = "WEIGHTING";
var TYPE_UNION = "UNION";
//var TYPE_BOOLEAN = "BOOLEAN";
//var TYPE_LIST = "LIST";
var TYPE_QUANTITY = "QTY";
var TYPE_UNKNOWN = "UNKNOWN";

var fictionSchema = Joi.object().keys({
    scriptFolder: Joi.string(),
    script: Joi.string().min(4).required()
});
var scriptSchema = Joi.object().keys({
    id: Joi.string().min(1).max(100).required(),
    query: Joi.string().min(5).max(100).required(),
    text: Joi.string().min(20).required()
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

var parseUnions = function(value) {
    var refs = extractRefs(value);
    return refs.found ? refs.extracted : [];
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
        unions: {},
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
            var isUnions = (section === 'unions') && isNotEmptyText;
            if (isUnions) {
                r.unions[asName(extractKey(token.text))] = parseUnions(extractValue(token.text).s);
            }
            var isModelAttribute = (section === 'models') && isNotEmptyText;
            if (isModelAttribute) {
                var modelAttrName = asName(extractKey(token.text));
                var previous = _.get(r.models, [modelName, modelAttrName]);
                var nextIdx = _.size(previous);
                _.set(r.models, [modelName, modelAttrName, nextIdx], extractModelAttribute(token.text));
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

var mergeObjs = function(total, n) {
    return _.merge(total, n);
};

var mergeScripts = function(scripts) {
    if (!_.isArray(scripts)) {
        return scripts;
    }
    var _scripts = _.chain(scripts);
    var r = {
        title: scripts[0].title,
        imports: _scripts.pluck('imports').flatten().uniq().value(),
        weighting: _scripts.pluck('weighting').reduceRight(mergeObjs).value(),
        frequency: _scripts.pluck('frequency').reduceRight(mergeObjs).value(),
        models: _scripts.pluck('models').reduceRight(mergeObjs).value(),
        unions: _scripts.pluck('unions').reduceRight(mergeObjs).value(),
        refs: _scripts.pluck('refs').reduceRight(mergeObjs).value()
    };

    return r;
};

var getValueType = function(value) {
    var hasRef = _.has(value, 'value.ref');
    return hasRef ? TYPE_REF : _.get(value, 'value.type');
};

var getRefType = function(_script, ref) {
    if (_script.has(['models', ref]).value()) {
        return TYPE_MODEL;
    } else if (_script.has(['refs', ref]).value()) {
        var vtype = getValueType(_script.get(['refs', ref]));
        var hasQty = 'float' === vtype;
        return hasQty ? TYPE_QUANTITY : TYPE_REF;
    } else if (_script.has(['unions', ref]).value()) {
        return TYPE_UNION;
    } else if (_script.has(['weighting', ref]).value()) {
        return TYPE_WEIGHTING;
    } else {
        return TYPE_UNKNOWN;
    }
};

var getRefValue = function(_script, ref) {
    var refType = getRefType(_script, ref);
    switch (refType) {
        case TYPE_REF:
            return _script.get(['refs', ref]).value();
        case TYPE_MODEL:
            return _script.get(['models', ref]).value();
        case TYPE_UNION:
            return _script.get(['unions', ref]).value();
        case TYPE_WEIGHTING:
            return _script.get(['.weighting', ref]).value();
        default:
            throw new Error('Unkown ref type:' + refType);
    }

};

var luckyQuantity = function(_script, chance, value) {
    var isDirectMinMax = _.has(value, 'quantity.max');
    if (isDirectMinMax) {
        return chance.nextInt(_.get(value, 'quantity.min'), _.get(value, 'quantity.min'));
    }
    var refs = _.get(value, 'quantity.refs', []);
    var qtyRefs = _script.get('refs').keys().intersection(refs).value();
    var isQtyRef = (_.size(qtyRefs) > 0) && (getRefType(_script, qtyRefs[0]));
    if (isQtyRef) {
        return chance.nextInt(_script.get('value.min'), _script.get('value.max'));
    }

    return 10;
};

var luckyDirectIndex = function(_script, chance, value) {
    var hasRefValue = _.has(value, 'value.ref');
    if (hasRefValue) {
        var ref = value.value.ref;
        return {
            v: ref,
            t: getRefType(_script, ref)
        };
    }
    var refs = _.get(value, 'quantity.refs', []);
    var weightingRefs = _script.get('weighting').keys().intersection(refs).value();
    var hasWeighting = (_.size(weightingRefs) > 0) && (_script.has(['weighting', weightingRefs[0]]));
    var luck = _.get(value, 'value');
    if (hasWeighting) {
        luck.weight = weightingRefs[0];
    }

    var hasSingleItem = _.size(luck.list) === 1;
    if (hasSingleItem) {
        return _.chain(luck).get('list').first().value();
    }

    return chance.next(luck);

};

var incCounter = function(chance) {
    chance.counter++;
    return chance.counter;
};

var inferChildToStack = function(_script, chance, stk, ref) {
    var refType = getRefType(_script, ref);
    var refValue = getRefValue(_script, ref);
    var name = [stk.root.k, ref, incCounter(chance)].join('-');
    var cloned = {
        refs: stk.refs,
        root: stk.root,
        parent: stk.child,
        child: {
            k: ref,
            t: refType,
            v: refValue,
            n: name
        }
    };
    return cloned;

};
var resolveUnionList = function(_script, ref) {
    var list= _script.get(['unions',ref]).value();
    //recursively solve or calculate all unions at the begining
    return list;
};

var resolveModelRight = function(_script, chance, facts, stack) {
    var parentQty = 1;
    var resolveAttrValues = function(values, key) {

        var resolveAttr = function(value) {
            var id = [stack.root.k, key, incCounter(chance)].join('-');
            var resolveOneAttr = function() {
                var resolveOneColumn = function(colValue) {
                    var li = luckyDirectIndex(_script, chance, colValue);
                    var isRef = _.has(li, 'v');
                    if (isRef) {
                        if (li.t === TYPE_MODEL) {
                            var modelStack = inferChildToStack(_script, chance, stack, li.v);
                            var modelRight = _.flattenDeep(resolveModelRight(_script, chance, facts, modelStack));
                            facts.push(modelRight);
                            return modelStack.child.n;
                        } else if (li.t === TYPE_REF) {
                            var relRefName = ['rel', li.t, stack.root.k, li.v].join('-').toLowerCase();
                            stack.refs[li.v]=relRefName;
                            return relRefName;
                        } else if (li.t === TYPE_UNION){
                            return resolveUnionList(_script,li.v);
                        } else {
                            throw new Error("Should not be here: "+stack);
                        }
                    } else {
                        return li;
                    }

                };

                var columns = _.map(value.values, resolveOneColumn);
                return {
                    i: id,
                    s: stack.child.n,
                    p: key,
                    o: columns
                };

            };
            return _.map(_.range(parentQty), resolveOneAttr);

        };
        var tripleValues = _.map(values, resolveAttr);
        return tripleValues;
    };

    return _.map(stack.child.v, resolveAttrValues);

};

var resolveStack = function(_script, chance, facts, stack) {
    if (1 === 3) {
        luckyQuantity();
    }
    var triples = resolveModelRight(_script, chance, facts, stack);
    facts.push(triples);
    return facts;
};


var produceQueryFacts = function(_script, chance, id, value) {
    if (TYPE_REF !== getValueType(value)) {
        throw new Error("The query should contain a reference !");
    }

    var ref = _.get(value, 'value.ref');
     var stack = {
        refs: {},
        root: {
            k: id,
            v: value,
            n: id
        },
        parent: {
            k: id,
            v: value,
            n: id
        },
    };
    var newStack = inferChildToStack(_script, chance, stack, ref);
    var r = resolveStack(_script, chance, [], newStack);

    return _.flatten(r, true);

};


var toChanceWeighting = function(keyValues) {
    return {
        name: keyValues[0],
        weights: _.map(keyValues[1], toNumber)
    };
};

var createChance = function(params, _script) {
    var chanceConf = {
        text: params.text,
        characters: [{
            chars: "0-9a-z",
            integer: 0
        }],
        weighting: _script.get('weighting').pairs().map(toChanceWeighting).value()

    };
    var chance = dazzlingChance(chanceConf);
    chance.counter = 0;
    return chance;

};

var spiceScript = function(params, script) {
    var _script = _.chain(script);
    _script.set('state.counter', 0);
    var query = extractModelAttribute(" " + params.query);
    var chance = createChance(params, _script);
    var value = _.get(query, 'values[0]');
    var facts = produceQueryFacts(_script, chance, params.id, value);
    return facts;
};

module.exports = function(cfg) {
    Joi.assert(cfg, fictionSchema);

    var fileScriptLoader = function(scriptName) {
        var scriptPath = cfg.scriptFolder + scriptName + FICTION_SUFFIX;
        return fs.readFileAsync(scriptPath, 'utf8');
    };

    var anyScriptLoader = fileScriptLoader;

    var loadMdScript = function(scriptName) {
        return anyScriptLoader(scriptName).then(text2obj);
    };

    var readImports = function(info) {
        return anyScriptLoader(info.scriptName).then(text2Imports).then(function(importList) {
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

    var parseScript = function() {
        return readScriptImports(cfg.script).map(loadMdScript);
    };

    var parseAndMergeScript = function() {
        return parseScript().then(mergeScripts);
    };

    var runScript = function(params) {
        Joi.assert(params, scriptSchema);
        var localScript = function(v) {
            return spiceScript(params, v);
        };
        return parseAndMergeScript().then(localScript);
    };

    var fiction = {
        _parseScript: parseScript,
        _parseAndMergeScript: parseAndMergeScript,
        readScriptImports: readScriptImports,
        runScript: runScript
    };

    return fiction;

};