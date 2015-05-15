var path = require('path');
var assert = require('assert');
var Hapi = require('hapi');
var validate = require('har-validator');
var haribo = require('../');
var pkg = require('../package.json');


describe('haribo', function () {

  this.timeout(30 * 1000);

  before(function (done) {
    var server = this.server = new Hapi.Server();
    server.connection({ port: 12345 });
    server.route({
      method: 'GET',
      path: '/{p*}',
      handler: {
        directory: {
          path: path.join(__dirname, 'sites')
        }
      }
    });
    server.start(done);
  });

  after(function (done) {
    this.server.stop(done);
  });

  it('should throw when URL not a string', function () {
    assert.throws(function () {
      haribo();
    }, function (err) {
      return err instanceof TypeError && /URL must be a string/i.test(err.message);
    });
  });

  it('should produce HAR with _failures when page fails to load', function (done) {
    haribo({ url: 'foo' })
      .on('failure', function (page) {
        assert.equal(page.id, 'foo');
      })
      .on('har', function (har) {
        assert.equal(har.log.pages.length, 0);
        assert.equal(har.log.entries.length, 0);
        assert.equal(har.log._failures.length, 1);
        assert.equal(har.log._failures[0].id, 'foo');
      })
      .on('end', done);
  });

  it('should create default 1 page HAR (simple site)', function (done) {
    var baseurl = 'http://127.0.0.1:12345/01-simple/';

    haribo({ url: baseurl })
      .on('har', function (har) {
        validate(har, function (err, valid) {
          assert.ok(!err);
          assert.ok(valid);
          assert.equal(har.log.version, '1.2');
          assert.equal(har.log.creator.name, pkg.name);
          assert.equal(har.log.creator.version, pkg.version);
          assert.equal(har.log.creator.comment, pkg.description);
          assert.equal(har.log.browser.name, 'PhantomJS');
          assert.equal(har.log.browser.version, '');
          assert.equal(har.log.browser.comment, '');
          assert.equal(har.log.pages.length, 1);
          assert.equal(har.log.entries.length, 2);
          assert.equal(har.log.comment, '');

          assert.equal(har.log.pages[0].id, baseurl);
          //assert.equal(har.log.pages[0].comment, '');
          assert.equal(typeof har.log.pages[0].startedDateTime, 'string');
          assert.equal(har.log.pages[0].title, 'Site 1');
          assert.equal(typeof har.log.pages[0].pageTimings.onContentLoad, 'number');
          assert.equal(typeof har.log.pages[0].pageTimings.onLoad, 'number');
          //assert.equal(har.log.pages[0].pageTimings.comment, '');
          assert.equal(typeof har.log.pages[0]._renderedSource, 'string');
          assert.equal(har.log.pages[0]._links.length, 2);
          assert.equal(har.log.pages[0]._links[0].text, 'About Us');
          assert.equal(har.log.pages[0]._links[0].href, baseurl + 'about.html');
          assert.equal(har.log.pages[0]._links[0].internal, true);
          assert.equal(har.log.pages[0]._links[1].text, 'Me on Twitter!');
          assert.equal(har.log.pages[0]._links[1].href, 'https://twitter.com/lupomontero');
          assert.equal(har.log.pages[0]._links[1].internal, false);

          har.log.entries.forEach(function (entry) {
            assert.equal(entry.pageref, baseurl);
            assert.equal(typeof entry.startedDateTime, 'string');
            assert.equal(typeof entry.time, 'number');
            assert.equal(entry.cache.beforeRequest, null);
            assert.equal(entry.cache.afterRequest, null);
            assert.equal(entry.connection, '');
            //assert.equal(entry.comment, '');
            assert.equal(entry.request.method, 'GET');
            assert.equal(typeof entry.request.url, 'string');
            assert.equal(entry.request.httpVersion, 'HTTP/1.1');
            assert.equal(typeof entry.request.headers.length, 'number');
            assert.equal(entry.request.queryString.length, 0);
            assert.equal(entry.request.cookies.length, 0);
            assert.equal(entry.request.headersSize, -1);
            assert.equal(entry.request.bodySize, 0);
            //assert.equal(entry.request.comment, '');

            assert.equal(entry.response.status, 200);
            assert.equal(entry.response.statusText, 'OK');
            assert.equal(entry.response.httpVersion, 'HTTP/1.1');
            assert.equal(entry.response.cookies.length, 0);
            assert.ok(entry.response.headers.length > 0);
            assert.equal(entry.response.redirectURL, '');
            assert.equal(entry.response.headersSize, -1);
            assert.ok(entry.response.bodySize > 0);
            //assert.equal(entry.response.comment, '');
            assert.equal(typeof entry.response.content.size, 'number');
            assert.equal(typeof entry.response.content.mimeType, 'string');

            assert.equal(typeof entry.timings.blocked, 'number');
            assert.equal(typeof entry.timings.dns, 'number');
            assert.equal(typeof entry.timings.connect, 'number');
            assert.equal(typeof entry.timings.send, 'number');
            assert.equal(typeof entry.timings.wait, 'number');
            assert.equal(typeof entry.timings.receive, 'number');
            assert.equal(typeof entry.timings.ssl, 'number');
          });
        });
      })
      .on('end', done);
  });

  it('should create 2 page HAR (simple site)', function (done) {
    var baseurl = 'http://127.0.0.1:12345/01-simple/';

    haribo({ url: baseurl, max: 2 })
      .on('har', function (har) {
        assert.equal(har.log.pages.length, 2);
      })
      .on('end', done);
  });

  it('should handle 403 on baseurl', function (done) {
    var baseurl = 'http://127.0.0.1:12345/02-forbidden/';

    // This URL returns a 403 as there is no index file and directory listing is
    // not enabled.

    haribo({ url: baseurl })
      .on('har', function (har) {
        var page = har.log.pages[0];
        assert.equal(page.id, baseurl);
        assert.equal(page.pageTimings.onContentLoad, -1);

        assert.equal(har.log.entries.length, 1);
        var entry = har.log.entries[0];
        assert.equal(entry.pageref, page.id);
        assert.equal(entry.request.url, page.id);
        assert.equal(entry.response.status, 403);
      })
      .on('end', done);
  });

  it('should follow broken link and report it', function (done) {
    var baseurl = 'http://127.0.0.1:12345/03-broken-link/';

    haribo({ url: baseurl, max: 2 })
      .on('har', function (har) {
        assert.equal(har.log.pages.length, 2);
        assert.equal(har.log.pages[0].id, baseurl);
        assert.equal(har.log.pages[1].id, baseurl + 'about.html');
        assert.equal(har.log.entries.length, 2);
        assert.equal(har.log.entries[0].pageref, baseurl);
        assert.equal(har.log.entries[0].request.url, baseurl);
        assert.equal(har.log.entries[0].response.status, 200);
        assert.equal(har.log.entries[1].pageref, baseurl + 'about.html');
        assert.equal(har.log.entries[1].request.url, baseurl + 'about.html');
        assert.equal(har.log.entries[1].response.status, 404);
      })
      .on('end', done);
  });

});

