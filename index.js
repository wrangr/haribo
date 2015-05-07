var url = require('url');
var qs = require('querystring');
var EventEmitter = require('events').EventEmitter;
var Nightmare = require('nightmare');
var normalize = require('normalizeurl');
var $ = require('cheerio');
var _ = require('lodash');


var phantomEvents = [
  'initialized',
  'loadStarted',
  'loadFinished',
  'urlChanged',
  'navigationRequested',
  'resourceRequestStarted',
  'resourceRequested',
  'resourceReceived',
  'resourceError',
  'consoleMessage',
  'alert',
  'confirm',
  'prompt',
  'error',
  'timeout'
];


function href2url($html, page, href) {
  var base = $html('base').attr('href');
  var pageUrlObj = url.parse(page.url);

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
  var pageUrlObj = url.parse(page.url);
  var hrefUrlObj = url.parse(href);
  return (pageUrlObj.host !== hrefUrlObj.host);
}


function extractTitle($html) {
  return $html('title').text();
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


function removeEscapedFragment(uri) {
  var urlParts = uri.split('?');
  var qsObj = qs.parse(urlParts[1]);
  delete qsObj._escaped_fragment_;
  var cleanUrl = urlParts[0];
  if (Object.keys(qsObj).length) { cleanUrl += '?' + qs.stringify(qsObj); }
  return cleanUrl;
}



module.exports = function (uri, opt) {

  opt = opt || {};

  var ee = new EventEmitter();
  var nightmare = new Nightmare();

  // Keep track of relative pathname to be able to scan a single file or a
  // subdirectory.
  var baseurl = uri;
  var urlObj = url.parse(uri);
  var pages = [];
  var max = opt.max || 1;
  var exclude = opt.exclude || [];
  var include = opt.include || [];


  function isExcluded(uri) {
    return exclude.reduce(function (memo, pattern) {
      // If exclude pattern has already been matched we skip.
      if (memo) { return memo; }
      // Initialise string patterns as regular expressions.
      if (typeof pattern === 'string') { pattern = new RegExp(pattern); }
      // Get relative url (relative to the baseurl).
      var relativeUri = uri.replace(new RegExp('^' + baseurl), '');
      return pattern.test(relativeUri);
    }, false);
  }


  function isIncluded(uri) {
    if (!include.length) { return true; }
    return include.reduce(function (memo, pattern) {
      if (memo) { return memo; }
      if (typeof pattern === 'string') { pattern = new RegExp(pattern); }
      var relativeUri = uri.replace(new RegExp('^' + baseurl), '');
      // Base URL itself can not be excluded by not being included...
      if (!relativeUri) { return true; }
      return pattern.test(relativeUri);
    }, false);
  }


  function fetchPage(uri, cb) {
    var time = new Date();
    var page = {
      url: uri,
      events: [],
      body: null
    };

    function pushPhantomEvent(eventName) {
      return function (args) {
        page.events.push({ name: eventName, args: args });
      };
    }

    phantomEvents.forEach(function (eventName) {
      nightmare.on(eventName, pushPhantomEvent(eventName));
    });

    nightmare
      .on('urlChanged', function (targetUrl) {
        page.url = targetUrl;
      })
      .on('resourceReceived', function (resource) {
        if (normalize(resource.url) === normalize(page.url)) {
          page.status = resource.status;
          page.headers = resource.headers;
        };
      })
      .on('exit', function (code, signal) {
        // TODO: Handle unexpected exit?
        //console.log('exit', code, signal);
      })
      .goto(uri)
      .evaluate(function () {
        return document.documentElement.outerHTML;
      }, function (body) {
        page.body = body;
      })
      .run(function (err) {
        if (err) { return cb(err); }
        // If request automatically followed a redirect to an external URL we ignore
        // the page.
        var resUrlObj = url.parse(page.url);
        var reqUrlObj = url.parse(uri);
        if (reqUrlObj.hostname !== resUrlObj.hostname) {
          // TODO: Handle external redirects before issuing request??
          return cb();
        }

        if (page.status !== 200) { return cb(null, page); }

        // Extract stuff from dom...
        var $html = $.load(page.body);
        page.title = extractTitle($html);
        page.meta = extractMeta($html);
        page.links = extractLinks($html, page);

        cb(null, page);
      });
  }


  function fetchSubPages(links, cb, remain) {
    if (!remain) { remain = links.slice(); }
    var link = remain.shift();
    if (!link) { return cb(); }
    fetchPages(link.url, function (err) {
      if (err) { return cb(err); }
      fetchSubPages(links, cb, remain);
    });
  }


  function fetchPages(uri, cb) {
    if (max && pages.length >= max) { return cb(); }

    var page = _.find(pages, function (page) { return page.url === uri; });
    if (page) { return cb(); }

    if (isExcluded(uri) || !isIncluded(uri)) { return cb(); }

    fetchPage(uri, function (err, page) {
      if (err) { return cb(err); }
      if (!page) { return cb(); }
      pages.push(page);
      ee.emit('page', page);
      // Before fetching subpages we filter out based on the base url.
      var r = new RegExp('^' + baseurl);
      var internalLinks = (page.links || {}).internal;
      var subpages = _.filter(internalLinks, function (link) {
        return r.test(link.url);
      });
      if (!subpages.length) { return cb(); }
      fetchSubPages(subpages, cb);
    });
  }


  process.nextTick(function () {
    fetchPages(uri, function (err) {
      if (err) { return ee.emit('error', err); }
      ee.emit('end');
    });
  });

  return ee;

};

