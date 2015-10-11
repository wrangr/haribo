var ChildProcess = require('child_process');
var Path = require('path');
var Events = require('events');
var Phantomjs = require('phantomjs');
var JSONStream = require('JSONStream');
var Validate = require('har-validator');
var Pkg = require('./package.json');


var internals = {};


internals.createHar = function (data, cb) {

  var har = {
    log: {
      version: '1.2',
      creator: {
        name: Pkg.name,
        version: Pkg.version,
        comment: Pkg.description
      },
      browser: {
        name: 'PhantomJS',
        version: Phantomjs.version
      },
      pages: [],
      entries: [],
      _failures: []
    }
  };

  data.forEach(function (obj) {

    if (obj.data._ignore === true) { return; }
    if (obj.name === 'page') {
      har.log.pages.push(obj.data);
    } else if (obj.name === 'entry') {
      har.log.entries.push(obj.data);
    } else if (obj.name === 'failure') {
      har.log._failures.push(obj.data);
    }
  });

  var stringified = JSON.stringify(har);
  var parsed = JSON.parse(stringified);

  Validate(parsed).then(function (valid) {

    if (!valid) {
      cb(new Error('Invalid HAR format'));
    } else {
      cb(null, parsed);
    }
  }, cb);
};


internals.optionKeys = [
  'exclude',
  'include',
  'max',
  'delay',
  'screenshot',
  'v-width',
  'v-height'
];


module.exports = function (options) {

  options = options || {};

  if (typeof options.url !== 'string') {
    throw new TypeError('URL must be a string');
  }

  var script = Path.join(__dirname, 'bin', 'sniff.js');
  var args = [script, options.url];

  internals.optionKeys.forEach(function (key) {

    if (!options.hasOwnProperty(key)) { return; }
    args.push('--' + key);
    args.push('' + options[key]);
  });

  var child = ChildProcess.spawn(Phantomjs.path, args);
  var parser = child.stdout.pipe(JSONStream.parse('*'));
  var ee = new Events.EventEmitter();
  var data = [];

  parser.on('data', function (obj) {

    ee.emit(obj.name, obj.data);
    data.push(obj);
  });

  child.on('close', function (code) {

    if (code > 0) { return ee.emit('error', new Error('PhantomJS crashed')); }

    internals.createHar(data, function (err, json) {

      if (err) {
        err.data = data;
        return ee.emit('error', err);
      }
      ee.emit('har', json);
      ee.emit('end');
    });
  });

  return ee;

};

