#! /usr/bin/env node

var fs = require('fs');
var path = require('path');
var util = require('util');
var minimist = require('minimist');
var _ = require('lodash');
var pkg = require('../package.json');
var argv = minimist(process.argv.slice(2));
var url = argv._.shift();


if (argv.v || argv.version) {
  console.log(pkg.version);
  process.exit(0);
} else if (!url || argv.h || argv.help) {
  console.log([
    'Usage: ' + pkg.name + ' [ options ] <url>',
    '',
    'Options:',
    '',
    '--exclude=<pattern>    Exclude URLs mathing given pattern.',
    '--include=<pattern>    Include URLs mathing given pattern.',
    '--max=1                Maximum number of pages to fetch.',
    '--out=</path/to/file>  Write HAR file to given path.',
    '--screenshot=false     Include screenshots.',
    '--v-width=400          Viewport width.',
    '--v-height=300         Viewport height.',
    '-h, --help             Show this help.',
    '-v, --version          Show version.',
    '',
    pkg.author.name + ' ' + (new Date()).getFullYear()
  ].join('\n'));
  process.exit(0);
}


var options = _.extend(_.omit(argv, [ '_', 'out' ]), { url: url });
var ee = require('../')(options);

ee.on('error', function (err) {
  console.error(util.inspect(err, { depth: null }));
  if (err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});

ee.on('har', function (har) {
  var json = JSON.stringify(har, null, 2);

  if (argv.out) {
    fs.writeFileSync(path.resolve(argv.out), json);
  } else {
    console.log(json);
  }
});

ee.on('end', function () {
  process.exit(0);
});

