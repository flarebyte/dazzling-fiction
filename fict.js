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
    baseDirectory: "" + getUserHome(),
    relativeDirectory: ".dazzling-fiction"
});

var conf = {
    state: "origin"
};
try {
    conf = confMng.load();
    conf.state = "loaded";
} catch (e) {
    conf.state = "failed";
    conf.error = e;
}

program
    .version(module.exports.version)
    .description(module.exports.description)
    .option('-f, --script <filename>', 'Fiction script file')
    .option('-q, --query <statement>', 'Query to evaluate')
    .option('-d, --dir [directory]', 'Directory for the script files')
    .option('-i, --id [prefix]', 'Prefix id for generated facts', 'a')
    .option('-o, --output [format]', 'output format', /^(json|csv)$/, 'csv')
    .option('-z, --reset', 'reset configuration')
    .parse(process.argv);

if (program.reset) {
    confMng.save({})
        .on("error", function(e) {
            process.stderr.write(e + "\n");
            process.exit(1);
        });
    console.log('Writing configuration to ' + JSON.stringify(confMng.configuration()));
    process.exit(0);
}


if (isNotConfigured(program, 'script')) {
    process.stderr.write('You need to provide a fiction script file --script\n');
    process.exit(1);
}
if (isNotConfigured(program, 'query')) {
    process.stderr.write('You need to provide a query to evaluate --query <statement>\n');
    process.exit(1);
}

var chunks = [];
stdin.resume();
stdin.setEncoding('utf8');
stdin.on('data', function(data) {
    chunks.push(data);
});
stdin.on('end', function() {
    var text = chunks.join();
    runScript(program, text, conf.curies);
});