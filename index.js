var url = require('url');
var EventEmitter = require('events').EventEmitter;
var normalize = require('normalizeurl');
var $ = require('cheerio');
var _ = require('lodash');
var which = require('which');
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


function extractMeta($html) {
  return _.compact($html('meta').map(function (i, meta) {
    var $meta = $(meta);
    var name = $meta.attr('name');
    if (name) {
      return { name: name, content: $meta.attr('content') };
    }
  }));
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


function createHar(page) {
  var entries = [];

  page.resources.forEach(function (resource) {
    var request = resource.request;
    var startReply = resource.startReply;
    var endReply = resource.endReply;

    if (!request || !startReply || !endReply) { return; }

    // Exclude Data URI from HAR file because they aren't included in spec
    if (request.url.match(/(^data:image\/.*)/i)) { return; }

    var requestTime = new Date(request.time);
    var startReplyTime = new Date(startReply.time);
    var endReplyTime = new Date(endReply.time);

    entries.push({
      startedDateTime: requestTime,
      time: endReplyTime - requestTime,
      request: {
        method: request.method,
        url: request.url,
        httpVersion: "HTTP/1.1",
        cookies: [],
        headers: request.headers,
        queryString: [],
        headersSize: -1,
        bodySize: -1
      },
      response: {
        status: endReply.status,
        statusText: endReply.statusText,
        httpVersion: "HTTP/1.1",
        cookies: [],
        headers: endReply.headers,
        redirectURL: "",
        headersSize: -1,
        bodySize: startReply.bodySize,
        content: {
          size: startReply.bodySize,
          mimeType: endReply.contentType
        }
      },
      cache: {},
      timings: {
        blocked: 0,
        dns: -1,
        connect: -1,
        send: 0,
        wait: startReplyTime - requestTime,
        receive: endReplyTime - startReplyTime,
        ssl: -1
      },
      pageref: page.id
    });
  });

  return {
    log: {
      version: '1.2',
      creator: {
        name: "PhantomJS",
        //version: phantom.version.major + '.' + phantom.version.minor +
        //  '.' + phantom.version.patch
      },
      pages: [{
        startedDateTime: page.startTime.toISOString(),
        id: page.id,
        title: page.title,
        pageTimings: {
          onLoad: page.endTime - page.startTime
        }
      }],
      entries: entries
    }
  };
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


  function done(err) {
    if (err) {
      ee.emit('error', err);
    } else {
      ee.emit('har', har);
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

