var cp = require('child_process');
var path = require('path');
var events = require('events');
var phantomjs = require('phantomjs');
var JSONStream = require('JSONStream');
var validate = require('har-validator');
var pkg = require('./package.json');
var script = path.join(__dirname, 'bin', 'sniff.js');


function createHar(data, cb) {
  var har = {
    log: {
      version: '1.2',
      creator: {
        name: pkg.name,
        version: pkg.version,
        comment: pkg.description
      },
      browser: {
        name: 'PhantomJS',
        version: phantomjs.version
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

  validate(parsed, function (err, valid) {
    if (err) {
      cb(err);
    } else if (!valid) {
      cb(new Error('Invalid HAR format'));
    } else {
      cb(null, parsed);
    }
  });
}
 

var optionKeys = [
  'exclude',
  'include',
  'max',
  'screenshot',
  'v-width',
  'v-height'
];


module.exports = function (options) {

  options = options || {};

  if (typeof options.url !== 'string') {
    throw new TypeError('URL must be a string');
  }

  var args = [ script, options.url ];

  optionKeys.forEach(function (key) {
    if (!options.hasOwnProperty(key)) { return; }
    args.push('--' + key);
    args.push(options[key]);
  });

  var child = cp.spawn(phantomjs.path, args);
  var parser = child.stdout.pipe(JSONStream.parse('*'));
  var ee = new events.EventEmitter();
  var data = [];
  
  parser.on('data', function (obj) {
    ee.emit(obj.name, obj.data);
    data.push(obj);
  });

  child.on('close', function (code) {
    if (code > 0) { return ee.emit('error', new Error('PhantomJS crashed')); }

    createHar(data, function (err, json) {
      if (err) { return ee.emit('error', err); }
      ee.emit('har', json);
      ee.emit('end');
    });
  });

  return ee;

};

