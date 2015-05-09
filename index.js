var url = require('url');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');


var fetch = require('./lib/fetch');
var har = require('./lib/har');


var defaults = {
  max: 1,
  exclude: [],
  include: []
};


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
  var ee = new EventEmitter();
  var pages = [];
  var entries = [];


  function done(err) {
    if (err) { return ee.emit('error', err); }
    har({ pages: pages, entries: entries }, function (err, json) {
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

    var matches = /^([a-z0-9+\.\-]+):/i.exec(uri);
    if (!matches || matches.length < 2) {
      uri = 'http://' + uri;
    } else if ([ 'http', 'https' ].indexOf(matches[1]) === -1) {
      return done(new Error('Unsupported scheme: ' + matches[1]));
    }

    var urlObj = url.parse(uri, true);
    if (!urlObj.hostname) {
      return done(new Error('Invalid URL'));
    }

    uri = url.format(urlObj);

    fetch(uri, function (err, page, pageEntries) {
      if (err) { return cb(err); }
      if (!page) { return cb(); }

      pages.push(page);
      entries = entries.concat(pageEntries);
      ee.emit('page', page, entries);

      // Before fetching subpages we filter out based on the base url.
      var r = new RegExp('^' + settings.url);
      var subpages = page._links.filter(function (link) {
        return r.test(link.href);
      });
      if (!subpages.length) { return cb(); }
      fetchSubPages(subpages, cb);
    });
  }


  process.nextTick(function () {
    fetchRecursive(settings.url, done);
  });

  return ee;

};

