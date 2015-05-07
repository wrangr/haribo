var url = require('url');
var Nightmare = require('nightmare');
var normalize = require('normalizeurl');
var _ = require('lodash');


//
// Parse given URL to get protocol and domain.
//
function createEntry(page, request) {
  //console.log(request);
  var urlObj = url.parse(request.url, true);
  var entry = {
    pageref: page.id,
    startedDateTime: new Date(),
    time: -1,
    request: {
      method: request.method,
      url: request.url,
      httpVersion: 'HTTP/1.1',
      headers: request.headers,
      queryString: _.map(urlObj.query, function (v, k) {
        return { name: k, value: k };
      }),
      //cookies: [],
      //postData: {},
      headersSize: -1,
      //bodySize: 0, // only for POST requests, why here?...
      comment: ''
    },
    response: null,
    cache: null,
    timings: {},
    serverIPAddress: '',
    connection: '',
    comment: '',
    _protocol: null,
    _domain: null,
    _query: null,
    _isSSL: false,
    _isBase64: false,
  };

  if (request.url.indexOf('data:') === 0) {
    entry._isBase64 = true;
    return entry;
  }

  var parsed = url.parse(request.url, true);

  entry._protocol = parsed.protocol.replace(':', '');
  entry._domain = parsed.hostname;
  entry._query = parsed.query;

  if (entry._protocol === 'https') {
    entry._isSSL = true;
  }

  return entry;
}


module.exports = function (uri, cb) {

  var nightmare = new Nightmare();
  var page = { id: uri, comment: '' };
  var entries = [];

  nightmare
    .on('urlChanged', function (targetUrl) {
      page.id = targetUrl;
    })
    .on('loadStarted', function () {
      page.startedDateTime = new Date();
    })
    .on('resourceRequested', function (request) {
      entries[request.id] = createEntry(page, request);
    })
    .on('resourceReceived', function (response) {
      var entry = entries[response.id];
      if (response.stage === 'start') {
        entry._startReply = response;
      } else if (response.stage === 'end') {
        entry._endReply = response;
      }
      if (normalize(response.url) === normalize(page.id)) {
        //page.status = reply.status;
        //page.headers = reply.headers;
      };
    })
    .on('exit', function (code, signal) {
      // TODO: Handle unexpected exit?
      console.log('exit', code, signal);
    })
    .goto(uri)
    .evaluate(function () {
      return {
        title: document.getElementsByTagName('title')[0].innerHTML,
        source: document.documentElement.outerHTML
      };
    }, function (props) {
      _.extend(page, props);
    })
    .run(function (err) {
      if (err) { return cb(err); }

      //page.endTime = new Date();
      page.pageTimings = {
        onContentLoad: 0,
        onLoad: 0,
        comment: ''
      };

      entries = _.compact(entries);

      // If request automatically followed a redirect to an external URL we ignore
      // the page.
      var resUrlObj = url.parse(page.id);
      var reqUrlObj = url.parse(uri);
      if (reqUrlObj.hostname !== resUrlObj.hostname) {
        // TODO: Handle external redirects before issuing request??
        return cb(null, page, entries);
      }

      if (page.status !== 200) { return cb(null, page, entries); }

      // Extract stuff from dom...
      //var $html = $.load(page.body);
      //page.meta = extractMeta($html);
      //page.links = extractLinks($html, page);

      //page.har = createHar(page);

      cb(null, page, entries);
    });
};

