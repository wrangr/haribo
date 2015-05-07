var url = require('url');
var EventEmitter = require('events').EventEmitter;
var validate = require('har-validator');
var normalize = require('normalizeurl');
var $ = require('cheerio');
var _ = require('lodash');
var pkg = require('./package.json');
var fetch = require('./lib/fetch');


var harDefaults = {
  version: '1.2',
  creator: {
    name: pkg.name,
    version: pkg.version,
    comment: pkg.description
  },
  browser: {
    name: 'PhantomJS',
    version: '',
    comment: ''
  },
  pages: [],
  entries: [],
  comment: ''
};


function href2url($html, page, href) {
  var base = $html('base').attr('href');
  var pageUrlObj = url.parse(page.id);

  if (!base) {
    base = pageUrlObj.protocol + '//' + pageUrlObj.host;
  }

  if (/^\/\//.test(href)) {
    href = pageUrlObj.protocol + href;
  } else if (/^\//.test(href)) {
    href = base + href;
  } else if (!/^(http|https)/.test(href)) {
    href = base + pageUrlObj.path + href;
  }

  var hrefUrlObj = url.parse(href);
  if (!hrefUrlObj.host) { hrefUrlObj.host = pageUrlObj.host; }

  // If there is a fragment we remove it as we are not interested...
  if (hrefUrlObj.hash) { delete hrefUrlObj.hash; }

  return url.format(hrefUrlObj);
}


function isExternal(page, href) {
  var pageUrlObj = url.parse(page.id);
  var hrefUrlObj = url.parse(href);
  return (pageUrlObj.host !== hrefUrlObj.host);
}


function extractLinks($html, page) {
  var links = { internal: [], external: [] };

  $html('a').map(function (i, a) {
    var $a = $(a);
    var href = $a.attr('href');
    var link = {
      text: $a.text().replace('\n', ' '),
      href: href,
      title: $a.attr('title'),
      target: $a.attr('target')
    };

    if (!href || /^(#|mailto)/.test(href)) { return; }

    link.url = href2url($html, page, href);

    if (isExternal(page, link.url)) {
      links.external.push(link);
    } else {
      links.internal.push(link);
    }
  });

  return links;
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

  // Initialise settings with defaults.
  var settings = _.extend({
    max: 1,
    exclude: [],
    include: []
  }, options);

  var har = _.extend({}, harDefaults);
  var ee = new EventEmitter();
  var pages = har.pages = [];


  function emitHar() {
    var json = {
      log: _.extend({}, har, {
        entries: har.entries.filter(function (entry) {
          return entry._ignore !== true;
        })
      })
    };

    var stringified = JSON.stringify(json);
    var parsed = JSON.parse(stringified);

    validate(parsed, function (err, valid) {
      if (err) {
        ee.emit('harError', err, json);
      } else if (!valid) {
        ee.emit('harInvalid', json);
      } else {
        ee.emit('har', json);
      }
    });
  }


  function done(err) {
    if (err) {
      ee.emit('error', err);
    } else {
      emitHar();
      ee.emit('end');
    }
    return ee;
  }


  function fetchSubPages(links, cb, remain) {
    if (!remain) { remain = links.slice(); }
    var link = remain.shift();
    if (!link) { return cb(); }
    fetchRecursive(link.url, function (err) {
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

    fetch(uri, function (err, page, entries) {
      if (err) { return cb(err); }
      if (!page) { return cb(); }
      pages.push(page);
      har.entries = har.entries.concat(entries);
      ee.emit('page', page);
      // Before fetching subpages we filter out based on the base url.
      var r = new RegExp('^' + settings.url);
      var internalLinks = (page.links || {}).internal;
      var subpages = _.filter(internalLinks, function (link) {
        return r.test(link.url);
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

