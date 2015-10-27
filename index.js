'use strict';
var Joi = require('joi');
var bluePromise = require("bluebird");
var fs = bluePromise.promisifyAll(require("fs-extra"));
var httpRequest = bluePromise.promisifyAll(require('request'));
var marked = require('marked');
var _ = require('lodash');
var S = require('string');
var dazzlingChance = require('dazzling-chance');

var FICTION_SUFFIX = '.fiction.md';
var YES_NO = 'yes/no';
var TYPE_REF = "REF";
var TYPE_MODEL = "MODEL";
var TYPE_WEIGHTING = "WEIGHTING";
//var TYPE_BOOLEAN = "BOOLEAN";
var TYPE_LIST = "LIST";
var TYPE_QUANTITY = "QTY";
var TYPE_UNKNOWN = "UNKNOWN";

var curieSchema = Joi.object().keys({
    startsWith: Joi.string().min(1).required(),
    contentType: Joi.string().required().valid('application/json', 'text/plain'),
    prefix: Joi.string().required(),
    suffix: Joi.string().required()
});

var fictionSchema = Joi.object().keys({
    scriptFolder: Joi.string(),
    script: Joi.string().min(4).required(),
    curies: Joi.array().items(curieSchema)
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

var extractCommand = function(value) {
    var cmd = extractBetween(value, '`', '`');
    return cmd;
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

var parseLists = function(value) {
    var command = extractCommand(value);
    if (command.found) {
        return {
            command: command.extracted.s
        };
    }
    var list = extractBetween(value, '*', '*');
    if (list.found) {
        var csvList = list.extracted.parseCSV();
        var listType = checkListType(csvList);
        if (listType === 'number') {
            csvList = _.map(csvList, toNumber);
        }
        return {
            type: listType,
            list: csvList
        };
    } else {
        return [];
    }
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
        lists: {},
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
                var freqMax = 1;
                for (var j = freqNames.length - 1; j >= 0; j--) {
                    var freqValue = S(freqValues[j]).toInt();
                    r.frequency[freqNames[j].toLowerCase()] = freqValue;
                    freqMax = (freqValue > freqMax) ? freqValue : freqMax;
                }
                r.frequency.max = freqMax;
            }

            var isRefs = (section === 'references') && isNotEmptyText;
            if (isRefs) {
                r.refs[asName(extractKey(token.text))] = parseAttributeItem(extractValue(token.text).s);
            }
            var isLists = (section === 'lists') && isNotEmptyText;
            if (isLists) {
                r.lists[asName(extractKey(token.text))] = parseLists(extractValue(token.text).s);
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
        lists: _scripts.pluck('lists').reduceRight(mergeObjs).value(),
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
        var vtype = getValueType(_script.get(['refs', ref]).value());
        var hasQty = 'float' === vtype;
        return hasQty ? TYPE_QUANTITY : TYPE_REF;
    } else if (_script.has(['lists', ref]).value()) {
        return TYPE_LIST;
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
        case TYPE_LIST:
            return _script.get(['lists', ref]).value();
        case TYPE_WEIGHTING:
            return _script.get(['.weighting', ref]).value();
        default:
            throw new Error('Unkown ref type:' + refType);
    }

};

var luckyQuantity = function(_script, chance, value) {
    var isDirectMinMax = _.has(value, 'quantity.max');
    if (isDirectMinMax) {
        var qtyMin = _.get(value, 'quantity.min');
        var qtyMax = _.get(value, 'quantity.max');
        var isLuck = qtyMin < qtyMax;
        return isLuck ? chance.nextInt(qtyMin, qtyMax) : qtyMin;
    }
    var refs = _.get(value, 'quantity.refs', []);
    var qtyRefs = _script.get('refs').keys().intersection(refs).value();
    var isQtyRef = (_.size(qtyRefs) > 0) && (getRefType(_script, qtyRefs[0]) === TYPE_QUANTITY);
    if (isQtyRef) {
        var qtyRefValue = _script.get(['refs', qtyRefs[0]]).value();
        return chance.nextInt(_.get(qtyRefValue, 'value.min'), _.get(qtyRefValue, 'value.max'));
    }

    return 5;
};

var luckyFrequency = function(_script, chance, value) {
    var freq = _script.get(['frequency', value]).value();
    if (freq === 0) {
        return false;
    }
    var freqMax = _script.get('frequency.max').value();
    var isMax = (freq === freqMax);
    if (isMax) {
        return true;
    }
    var luck = chance.nextInt(0, freqMax);
    return (luck <= freq);
};

var luckyInList = function(chance, value) {
    var hasSingleItem = _.size(value.list) === 1;
    if (hasSingleItem) {
        return _.chain(value).get('list').first().value();
    } else {
        return chance.next(value);
    }
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

    return luckyInList(chance, luck);
};

var incCounter = function(chance) {
    chance.counter++;
    return chance.counter;
};

var inferChildToStack = function(_script, chance, stk, ref, idx) {
    var refType = getRefType(_script, ref);
    var refValue = getRefValue(_script, ref);
    var isReference = stk.parent && TYPE_REF === stk.parent.t;
    var name = isReference ? ['ref', stk.parent.n].join('-') : [stk.root.k, ref, incCounter(chance), idx + 1].join('-');
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

var stringToCSV = function(str) {
    return S(str).parseCSV("\n");
};

var normalizeList = function(list) {
    var listType = checkListType(list);
    var nList = listType === 'number' ? _.map(list, toNumber) : list;
    return {
        type: listType,
        list: nList
    };

};

var justBody = function(resp) {
    return _.chain(resp).first().get('body').value();
};

var UTF8_ENC = {
    'encoding': 'utf8'
};

var fileListLoaderAsync = function(v) {
    var isJson = v.contentType === 'application/json';
    return isJson ? fs.readJsonAsync(v.path) : fs.readFileAsync(v.path, UTF8_ENC).then(stringToCSV);
};

var webListLoaderAsync = function(v) {
    var isJson = v.contentType === 'application/json';
    var reqConf = {
        uri: v.path,
        headers: {
            "accept": v.contentType
        },
        json: isJson,
        encoding: "utf8",
        timeout: 5000
    };



    return isJson ? httpRequest.getAsync(reqConf).then(justBody) : httpRequest.getAsync(reqConf).then(justBody).then(stringToCSV);
};
var listLoaderAsync = function(v) {
    var hasHttp = S(v.path).startsWith('http://') || S(v.path).startsWith('https://');
    var loader = hasHttp ? webListLoaderAsync(v) : fileListLoaderAsync(v);
    return loader.then(normalizeList);
};

var uncurify = function(cfg, uri) {
    var curies = cfg.curies;
    if (_.size(curies) < 1) {
        return {
            uri: uri,
            path: uri,
            contentType: 'text/plain'
        };
    }

    var u = S(uri);
    for (var i = 0; i < curies.length; i++) {
        var curie = curies[i];
        if (u.startsWith(curie.startsWith)) {
            var path = [curie.prefix, u.chompLeft(curie.startsWith).s, curie.suffix].join('');
            return {
                uri: uri,
                path: path,
                contentType: curie.contentType
                //loaderAsync: listLoaderAsync(path)
            };
        }
    }
    return {
        uri: uri,
        path: uri,
        contentType: 'text/plain',
        //loaderAsync: listLoaderAsync(uri)
    };
};

var resolveList = function(_script, chance, ref) {
    var list = _script.get(['lists', ref]);
    var hasCommand = list.has('command').value();
    if (hasCommand) {
        var cmd = list.get('command').value();
        var cached = _script.get(['cachedList', cmd]).value();
        if (!_.isObject(cached)) {
            throw new Error("List should have been cached");

        }
        return luckyInList(chance, cached);
    }

    return luckyInList(chance, list.value());
};

var retrieveLists = function(script) {
    var cmdLists = _.pluck(_.filter(_.values(script.lists), 'command'), 'command');
    if (_.isEmpty(cmdLists)) {
        return script;
    }

    var uncurifyCmd = function(cmd) {
        var ucmd = uncurify(script.cfg, cmd);
        return ucmd;
    };

    var cmdObjs = _.map(cmdLists, uncurifyCmd);


    var loaders = _.map(cmdObjs, function(cmdObj) {
        return listLoaderAsync(cmdObj).then(function(rList) {
            script.cachedList[cmdObj.uri] = rList;
        });
    });

    var passScript = function() {
        return script;
    };

    return bluePromise.all(loaders).then(passScript);
};


var resolveModelRight = function(_script, chance, facts, stack) {
    var resolveAttrValues = function(values, key) {
        var resolveAttr = function(value) {
            var notWished = !luckyFrequency(_script, chance, value.frequency);
            var noValue = _.isEmpty(value.values);
            var attrQuantity = (noValue || notWished) ? 1 : luckyQuantity(_script, chance, _.chain(value).get('values').first().value());
            var resolveOneAttr = function(oneAttrIdx) {
                var resolveOneColumn = function(colValue) {
                    var li = luckyDirectIndex(_script, chance, colValue);
                    var isRef = _.has(li, 'v');
                    if (isRef) {
                        if (li.t === TYPE_MODEL) {
                            var modelStack = inferChildToStack(_script, chance, stack, li.v, oneAttrIdx);
                            var modelRight = _.flattenDeep(resolveModelRight(_script, chance, facts, modelStack));
                            facts.push(modelRight);
                            return modelStack.child.n;
                        } else if (li.t === TYPE_REF) {
                            var relRefName = [li.t, stack.root.k, li.v].join('-').toLowerCase();
                            stack.refs[li.v] = relRefName;
                            chance.refsToResolve[li.v] = 'Y';
                            return relRefName;
                        } else if (li.t === TYPE_LIST) {
                            return resolveList(_script, chance, li.v);
                        } else {
                            throw new Error("Should not be here: " + stack);
                        }
                    } else {
                        return li;
                    }

                };

                var columns = _.map(value.values, resolveOneColumn);
                return {
                    s: stack.child.n,
                    p: key,
                    o: columns
                };

            };
            return notWished ? [] : _.map(_.range(attrQuantity), resolveOneAttr);

        };
        var tripleValues = _.map(values, resolveAttr);
        return tripleValues;
    };

    return _.map(stack.child.v, resolveAttrValues);

};

var resolveStack = function(_script, chance, facts, stack) {
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

    var resolveQueryStack = function(n) {
        var newStack = inferChildToStack(_script, chance, stack, ref, n);
        return resolveStack(_script, chance, [], newStack);
    };
    var qty = luckyQuantity(_script, chance, value);
    var r = _.map(_.range(qty), resolveQueryStack);

    return _.flatten(r, true);

};

var produceRefsFacts = function(_script, chance, runId) {
    var refs = _.keys(chance.refsToResolve);
    if (_.isEmpty(refs)) {
        return [];
    }

    var resolveRefStack = function(refId) {
        var value = _script.get(['refs', refId]).value();
        if (TYPE_REF !== getValueType(value)) {
            throw new Error("The ref should contain a reference: " + refId);
        }
        var ref = _.get(value, 'value.ref');
        var id = [runId, refId].join('-'); //TODO iterate on all

        var stack = {
            refs: {},
            root: {
                k: id,
                v: value,
                t: TYPE_REF,
                n: id
            },
            parent: {
                k: id,
                v: value,
                t: TYPE_REF,
                n: id
            },
        };
        var newStack = inferChildToStack(_script, chance, stack, ref);
        return resolveStack(_script, chance, [], newStack);
    };
    var r = _.map(refs, resolveRefStack);

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
    chance.cachedList = {};
    chance.refsToResolve = {};
    return chance;

};

var produceScriptFacts = function(_script, chance, runId) {
    var modelFacts = function(modelAttributes, model) {
        var prefixWithModel = function(m) {
            var id = incCounter(chance);
            var r = {
                "i": runId + '-' + m + "-" + id,
                "s": m,
                "p": "child-of-fiction-model",
                "o": [
                    model
                ]
            };
            return r;
        };
        var modelAttrs = _.keys(modelAttributes);
        return _.map(modelAttrs, prefixWithModel);

    };
    var scriptFacts = _script.get('models').map(modelFacts).value();
    return _.flatten(scriptFacts, true);
};

var spiceScript = function(cfg, params, script) {
    script.state = {
        counter: 0
    };
    script.cachedList = {};
    script.cfg = cfg;
    script.params = params;
    return script;
};

var scriptToFacts = function(script) {
    var _script = _.chain(script);
    var params = script.params;
    var query = extractModelAttribute(" " + params.query);
    var chance = createChance(params, _script);
    var value = _.get(query, 'values[0]');
    var queryFacts = produceQueryFacts(_script, chance, params.id, value);
    var scriptFacts = produceScriptFacts(_script, chance, params.id);
    var refFacts = produceRefsFacts(_script, chance, params.id);
    var facts = scriptFacts.concat(queryFacts, refFacts);
    return facts;
};




var asTripleCSV = function(row) {
    var mergedRow = [row.s, row.p].concat(row.o);
    var r = S(mergedRow).toCSV();
    return r;
};

var asCSVResults = function(results) {
    var rows = _.map(results, asTripleCSV);
    return rows.join("\n");
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
            return spiceScript(cfg, params, v);
        };
        return parseAndMergeScript().then(localScript).then(retrieveLists).then(scriptToFacts);
    };

    var runScriptCsv = function(params) {
        return runScript(params).then(asCSVResults);
    };

    var fiction = {
        _parseScript: parseScript,
        _parseAndMergeScript: parseAndMergeScript,
        readScriptImports: readScriptImports,
        runScript: runScript,
        runScriptCsv: runScriptCsv
    };

    return fiction;

};