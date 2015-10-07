#!/usr/bin/env node

'use strict';
var program = require('commander');
var dazzlingFiction = require('./');
var _ = require('lodash');
var S = require('string');
var confiture = require('confiture');
require('pkginfo')(module);
var stdin = process.stdin;


var runScript = function(prog, text, curies) {
    var scriptFolder = S(process.cwd()).ensureRight('/').s;
    if (prog.dir) {
        var isAbsoluteDir = S(prog.dir).startsWith('/');
        scriptFolder = isAbsoluteDir ? S(prog.dir) : S(process.cwd()).ensureRight('/').s + prog.dir;
        scriptFolder = S(scriptFolder).ensureRight('/').s;
    }
    var fictionConfig = {
        scriptFolder: scriptFolder,
        script: prog.script
    };

    if (_.isArray(curies)) {
        fictionConfig.curies = curies;
    }

    var params = {
        id: prog.id,
        query: prog.query,
        text: text
    };


    var fiction = dazzlingFiction(fictionConfig);
    var runner = function() {
        if (prog.output === 'json') {
            return fiction.runScript(params);
        } else if (prog.output === 'csv') {
            return fiction.runScriptCsv(params);
        } else {
            return fiction.runScriptCsv(params);
        }
    };

    runner().then(function(results) {
        console.log(results);
    }).catch(function(e) {
        console.log(e);
    });

};

var isNotConfigured = function(prog, key) {
    var value = prog[key];
    return !_.isString(value);
};

function getUserHome() {
  return process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
}

var confMng = confiture({
    name: "conf",
    schema: __dirname + "/schemas/conf.schema.json",
    baseDirectory: getUserHome(),
    relativeDirectory: ".dazzling-fiction"
});

var conf = {};
try {
    conf = confMng.load();
} catch (e) {
    //let's ignore it we are not sure it is has been created
}

program
    .version(module.exports.version)
    .description(module.exports.description)
    .option('-d, --dir [directory]', 'Directory for the script files')
    .option('-f, --script <filename>', 'Fiction script file')
    .option('-i, --id [prefix]', 'Prefix id for generated facts', 'a')
    .option('-q, --query <statement>', 'Query to evaluate')
    .option('-o, --output [format]', 'output format', /^(json|csv)$/, 'csv')
    .parse(process.argv);

var chunks = [];
stdin.resume();
stdin.setEncoding('utf8');
stdin.on('data', function(data) {
    chunks.push(data);
});
stdin.on('end', function() {
    var text = chunks.join();

    if (isNotConfigured(program, 'dir')) {
        process.stderr.write('You need to provide a directory --dir [directory]');
        return;
    }
    if (isNotConfigured(program, 'script')) {
        process.stderr.write('You need to provide a fiction script file --script');
        return;
    }
    if (isNotConfigured(program, 'query')) {
        process.stderr.write('You need to provide a query to evaluate --query <statement>');
        return;
    }
    runScript(program, text, conf.curies);
});