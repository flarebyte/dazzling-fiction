#!/usr/bin/env node
'use strict';
var meow = require('meow');
var dazzlingFiction = require('./');

var cli = meow({
  help: [
    'Usage',
    '  dazzling-fiction <input>',
    '',
    'Example',
    '  dazzling-fiction Unicorn'
  ].join('\n')
});

dazzlingFiction(cli.input[0]);
