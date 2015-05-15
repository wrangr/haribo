var cp = require('child_process');
var url = require('url');
var path = require('path');
var events = require('events');
var _ = require('lodash');
var JSONStream = require('JSONStream');
var phantomjs = require('phantomjs');
var script = path.join(__dirname, 'lib', 'sniff.js');
var har = require('./lib/har');


var defaults = {
  max: 1,
  exclude: [],
  include: []
};


function sniff(uri) {
  var child = cp.spawn(phantomjs.path, [ script, uri ]);
  var parser = child.stdout.pipe(JSONStream.parse('*'));
  var ee = new events.EventEmitter();
  
  parser.on('data', function (obj) {
    if (obj.name === 'page') {
      var pageUrlObj = url.parse(obj.data.id);
      obj.data._links.forEach(function (link) {
        link.internal = pageUrlObj.host === url.parse(link.href).host;
      });
    }
    ee.emit(obj.name, obj.data);
  });

  child.on('close', function (code) {
    if (code > 0) { return ee.emit('error', new Error('PhantomJS crashed')); }
    ee.emit('end');
  });

  return ee;
}


function isExcluded(settings, uri) {
  return settings.exclude.reduce(function (memo, pattern) {
    // If exclude pattern has already been matched we skip.
    if (memo) { return memo; }
    // Initialise string patterns as regular expressions.
    if (typeof pattern === 'string') { pattern = new RegExp(pattern); }
    // Get relative url (relative to the baseurl).
    var relativeUri = uri.replace(new RegExp('^' + settings.url), '');
    return pattern.test(relativeUri);
  }, false);
}


function isIncluded(settings, uri) {
  if (!settings.include.length) { return true; }
  return settings.include.reduce(function (memo, pattern) {
    if (memo) { return memo; }
    if (typeof pattern === 'string') { pattern = new RegExp(pattern); }
    var relativeUri = uri.replace(new RegExp('^' + settings.url), '');
    // Base URL itself can not be excluded by not being included...
    if (!relativeUri) { return true; }
    return pattern.test(relativeUri);
  }, false);
}


module.exports = function (options) {

  var settings = _.extend(defaults, options);
  var ee = new events.EventEmitter();
  var pages = [];
  var entries = [];
  var failures = [];


  function done(err) {
    if (err) { return ee.emit('error', err); }
    har({ pages: pages, entries: entries, failures: failures }, function (err, json) {
      if (err) { return ee.emit('error', err); }
      ee.emit('har', json);
      ee.emit('end');
    });
  }


  function fetchSubPages(links, cb, remain) {
    if (!remain) { remain = links.slice(); }
    var link = remain.shift();
    if (!link) { return cb(); }
    fetchRecursive(link.href, function (err) {
      if (err) { return cb(err); }
      fetchSubPages(links, cb, remain);
    });
  }


  function fetchRecursive(uri, cb) {
    if (settings.max && pages.length >= settings.max) { return cb(); }

    var found = _.find(pages, function (page) { return page.id === uri; });
    if (found) { return cb(); }

    if (isExcluded(settings, uri) || !isIncluded(settings, uri)) { return cb(); }

    //console.log(uri);

    var sniffer = sniff(uri);
    
    sniffer.on('error', cb);
    
    sniffer.on('failure', function (page) {
      failures.push(page);
      ee.emit('failure', page);
    });
    
    sniffer.on('entry', function (entry) {
      entries.push(entry);
      ee.emit('entry', entry);
    });

    var currPage;

    sniffer.on('page', function (page) {
      pages.push(page);
      ee.emit('page', page);
      currPage = page;
    });

    sniffer.on('end', function () {
      if (!currPage) { return cb(); }
      // Before fetching subpages we filter out based on the base url.
      var r = new RegExp('^' + settings.url);
      var subpages = currPage._links.filter(function (link) {
        return r.test(link.href);
      });
      if (!subpages.length) { return cb(); }
      fetchSubPages(subpages, cb);
    });
  }


  if (typeof settings.url !== 'string') {
    throw new TypeError('URL must be a string');
  }

  //var matches = /^([a-z0-9+\.\-]+):/i.exec(settings.url);
  //if (!matches || matches.length < 2) {
  //  settings.url = 'http://' + settings.url;
  //} else if ([ 'http', 'https' ].indexOf(matches[1]) === -1) {
  //  return done(new Error('Unsupported scheme: ' + matches[1]));
  //}

  //var urlObj = url.parse(uri, true);
  //if (!urlObj.hostname) {
  //  return done(new Error('Invalid URL'));
  //}

  //settings.url = url.format(urlObj);

  process.nextTick(function () {
    fetchRecursive(settings.url, done);
  });

  return ee;

};

