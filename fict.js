#!/usr/bin/env node

'use strict';
var dazzlingFiction = require('./');
var fs = require('fs');
var program = require('commander');
var _ = require('lodash');
var S = require('string');
var confiture = require('confiture');
var solaceCreator = require('solace');
var jsonCommander = require('json-commander');
var getStdin = require('get-stdin');

require('pkginfo')(module);

var solace = solaceCreator({
  defaultTheme: 'outline'
});

function getUserHome() {
    return process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
}

var fileExists = function(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
};

var confJsonSchema = __dirname + "/schemas/conf.schema.json";

var configurator = confiture({
    name: "conf",
    schema: confJsonSchema,
    baseDirectory: "" + getUserHome(),
    relativeDirectory: ".dazzling-fiction"
});

var confFilePath = configurator.configuration().filepath;
var confFileExists = fileExists(confFilePath);

var cmdr = jsonCommander({
  schema: confJsonSchema,
  tableFriendly: true
});

var conf = confFileExists ? configurator.load() : {};
if (_.isError(conf)){
    solace.log(conf);
    process.exit(1);
}
var unalteredConf = _.cloneDeep(conf);

var setupProgram = function(cmd, other) {
    solace = solaceCreator({defaultTheme: 'outline'});
    var hasOther = !_.isEmpty(other);
    var cmdOptions = hasOther ? [cmd].concat(other) : [cmd];
    var isWriting = cmd === 'set' || cmd === 'copy' || cmd === 'del' || cmd === 'insert';
    if (isWriting) {
      cmdr.evaluate(unalteredConf, cmdOptions);
      configurator.saveSync(unalteredConf);
      solace.log(cmd + ' done.');
    } else {
      var evaluation = cmdr.evaluate(unalteredConf, cmdOptions);
      solace.log(evaluation);
    }
  };

var runScript = function(prog, query, scriptName, directory, text, cfg) {

    var scriptFolder = S(process.cwd()).ensureRight('/').s;
    if (directory) {
        var isAbsoluteDir = S(directory).startsWith('/');
        scriptFolder = isAbsoluteDir ? S(directory) : S(process.cwd()).ensureRight('/').s + directory;
        scriptFolder = S(scriptFolder).ensureRight('/').s;
    }
    var fictionConfig = {
        scriptFolder: scriptFolder,
        script: scriptName
    };

    if (_.isArray(cfg.curies)) {
        fictionConfig.curies = cfg.curies;
    }

    var params = {
        id: prog.id,
        query: query,
        text: text
    };

    var outputFmt = prog.output ? prog.output : conf.outputFormat ? conf.outputFormat : 'csv';
    var printFmt = prog.print ? prog.print : conf.print ? conf.print : 'outline';
    solace = solaceCreator({defaultTheme: printFmt});

    var fiction = dazzlingFiction(fictionConfig);
    var runner = function() {
        return outputFmt === 'json' ? fiction.runScript(params) : fiction.runScriptCsv(params);
    };

    runner().then(function(results) {
        solace.log(results);
    }).catch(function(e) {
        solace.log(e);
    });

};

var runScriptCommand = function(query, scriptName, directory) {
  getStdin().then(function(text)  {
    runScript(program, query, scriptName, directory, text, conf);
  });
};

program
  .description(module.exports.description)
  .version(module.exports.version)
  .option('-i, --id [prefix]', 'Prefix id for generated facts', 'a')
  .option('-o, --output [format]', 'output format', /^(json|csv)$/)
  .option('-p, --print [format]', 'print format', /^(outline|beautiful|machine)$/);

program
  .command('run <query> <scriptName> <directory>')
    .description('run the fiction script')
    .action(runScriptCommand);

program
  .command('setup <cmd> [other...]')
    .description('configure fiction')
    .action(setupProgram);

program.parse(process.argv);
