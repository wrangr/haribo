var url = require('url');
var EventEmitter = require('events').EventEmitter;
var Nightmare = require('nightmare');
var normalize = require('normalizeurl');
var $ = require('cheerio');
var _ = require('lodash');


//
// Parse given URL to get protocol and domain.
//
function parseResourceUrl(resource) {
  if (resource.url.indexOf('data:') === 0) {
    // base64 encoded data
    resource.domain = false;
    resource.protocol = false;
    resource.isBase64 = true;
    return;
  }

  var parsed = url.parse(resource.url);

  resource.protocol = parsed.protocol.replace(':', '');
  resource.domain = parsed.hostname;
  resource.query = parsed.query;

  if (resource.protocol === 'https') {
    resource.isSSL = true;
  }
}


function parseResource(resource) {
  resource.headers = _.reduce(resource.headers, function (memo, header) {
    memo[header.name.toLowerCase()] = header.value;
    return memo;
  }, {});

  if (typeof resource.time === 'string') {
    resource.time = new Date(resource.time);
  }
}


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
      pageref: page.url
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
        id: page.url,
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


module.exports = function (options, cb) {

  // Initialise settings with defaults.
  var settings = _.extend({
    max: 1,
    exclude: [],
    include: []
  }, options);

  cb = cb || function () {};


  var ee = new EventEmitter();
  var nightmare = new Nightmare();
  var pages = [];


  function done(err, data) {
    if (err) {
      ee.emit('error', err);
      return cb(err);
    }
    ee.emit('end', data);
    cb(null, data);
  }


  function fetchPage(uri, cb) {
    var page = { url: uri, resources: [] };

    nightmare
      .on('urlChanged', function (targetUrl) {
        page.url = targetUrl;
      })
      .on('loadStarted', function () {
        page.startTime = new Date();
      })
      .on('resourceRequested', function (req) {
        parseResource(req);
        page.resources[req.id] = {
          request: req,
          startReply: null,
          endReply: null
        };
      })
      .on('resourceReceived', function (reply) {
        var resource = page.resources[reply.id];
        parseResource(reply);
        if (reply.stage === 'start') {
          resource.startReply = reply;
        } else if (reply.stage === 'end') {
          resource.endReply = reply;
        }
        if (normalize(reply.url) === normalize(page.url)) {
          //page.status = reply.status;
          //page.headers = reply.headers;
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

        page.endTime = new Date();
        page.resources = _.compact(page.resources);

        if (page.status !== 200) { return cb(null, page); }

        // Extract stuff from dom...
        var $html = $.load(page.body);
        page.title = $html('title').text();
        //page.meta = extractMeta($html);
        page.links = extractLinks($html, page);

        //page.har = createHar(page);

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
    if (settings.max && pages.length >= settings.max) { return cb(); }

    var found = _.find(pages, function (page) { return page.url === uri; });
    if (found) { return cb(); }

    if (isExcluded(settings, uri) || !isIncluded(settings, uri)) { return cb(); }

    fetchPage(uri, function (err, page) {
      if (err) { return cb(err); }
      if (!page) { return cb(); }
      pages.push(page);
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
    fetchPages(settings.url, function (err) {
      if (err) { return ee.emit('error', err); }
      ee.emit('end');
    });
  });

  return ee;

};

