#! /usr/bin/env node

var fs = require('fs');
var path = require('path');
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
    '--out=</path/to/file>  Write HAR file to given path.',
    '--max=<int>            Maximum number of pages to fetch.',
    '--include=<pattern>    Include URLs mathing given pattern.',
    '--exclude=<pattern>    Exclude URLs mathing given pattern.',
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
  console.error(err);
  process.exit(1);
});

ee.on('harError', function (harError, har) {
  console.error(harError);
  console.error(har.log.pages);
  process.exit(2);
});

ee.on('harInvalid', function (har) {
  console.error('Invalid HAR');
  console.error(har);
  process.exit(3);
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

