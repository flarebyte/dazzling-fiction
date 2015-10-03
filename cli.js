#!/usr/bin/env node

'use strict';
var program = require('commander');
var dazzlingFiction = require('./');
var S = require('string');

var runScript = function(prog) {
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

    var params = {
        id: prog.id,
        query: prog.query,
        text: prog.text
    };


    var fiction = dazzlingFiction(fictionConfig);
    var runner = function() {
        if (prog.format === 'json') {
            return fiction.runScript(params);
        } else if (prog.format === 'csv') {
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


program
    .version('0.0.1')
    .description('Run the fiction script')
    .option('-d, --dir [directory]', 'Directory for the script files')
    .option('-f, --script <filename>', 'Fiction script file')
    .option('-i, --id [prefix]', 'Prefix id for generated facts', 'a')
    .option('-q, --query <statement>', 'Query to evaluate')
    .option('-t, --text <text>', 'Text used for generating random values')
    .option('-o, --output [format]', 'output format', /^(json|csv)$/, 'csv')
    .parse(process.argv);

runScript(program);