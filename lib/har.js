/*eslint no-var:0, prefer-arrow-callback: 0, object-shorthand: 0 */

'use strict';


//
// Create resource entry for new outgoing request.
//
exports.createEntry = function (page, request) {

  var entry = {
    pageref: page.id,
    startedDateTime: request.time,
    time: -1,
    request: {
      method: request.method,
      url: request.url,
      httpVersion: 'HTTP/1.1',
      headers: request.headers,
      queryString: [], // This can be added later in node.js?
      cookies: [],
      //postData: {},
      headersSize: -1,
      bodySize: 0 // only for POST requests, why here?...
      //comment: ''
    },
    response: null,
    cache: {
      beforeRequest: null,
      afterRequest: null
    },
    timings: {},
    //serverIPAddress: '',
    connection: ''
    //comment: ''
  };

  // Ignore data urls.
  if (request.url.indexOf('data:') === 0) {
    entry._isBase64 = true;
    entry._ignore = true;
  }

  return entry;
};


//
// Compute entry properties once the response has ended.
//
exports.processEntry = function (entry) {

  var request = entry.request;
  var startReply = entry._startReply;
  var endReply = entry._endReply;

  // TODO: Handle entries with _errorReply!
  if (!request || !startReply || !endReply) {
    entry._ignore = true;
    return;
  }

  var bodySize = endReply.bodySize || startReply.bodySize || -1;

  //delete entry._startReply;
  //delete entry._endReply;

  entry.response = {
    status: endReply.status || 0,
    statusText: endReply.statusText || '',
    httpVersion: 'HTTP/1.1',
    cookies: [],
    headers: endReply.headers,
    redirectURL: '',
    headersSize: -1,
    bodySize: bodySize,
    content: {
      size: bodySize,
      mimeType: endReply.contentType || ''
    }
    //comment: ''
  };

  entry.time = endReply.time - entry.startedDateTime;
  entry.timings = {
    blocked: 0,
    dns: -1,
    connect: -1,
    send: 0,
    wait: startReply.time - entry.startedDateTime,
    receive: endReply.time - startReply.time,
    ssl: -1
  };
};
