var path = require('path');
var assert = require('assert');
var Hapi = require('hapi');
var fetch = require('../lib/fetch');


describe('haribo/fetch', function () {

  this.timeout(30 * 1000);

  before(function (done) {
    var server = this.server = new Hapi.Server();
    server.connection({ port: 12345 });
    server.route({
      method: 'GET',
      path: '/{p*}',
      handler: {
        directory: {
          path: path.join(__dirname, 'sites/01-simple')
        }
      }
    });
    server.start(done);
  });

  after(function (done) {
    this.server.stop(done);
  });

  it('should pass both page and entries in callback', function (done) {
    var url = 'http://127.0.0.1:12345/';
    fetch(url, function (err, page, entries) {
      assert.ok(!err);
      assert.equal(page.id, url);
      assert.equal(page.title, 'Site 1');
      assert.ok(entries.length > 0);
      entries.forEach(function (entry) {
        assert.equal(entry.pageref, url);
      });
      done();
    });
  });

  it('should emit events', function (done) {
    var url = 'http://127.0.0.1:12345/';
    var ee = fetch(url);
    var events = [];

    ee.on('data', function (obj) {
      events.push(obj);
    });

    ee.on('end', function () {
      assert.equal(events.length, 3);

      var page = events.reduce(function (memo, ev) {
        if (ev.name === 'page') { return ev.data; }
        return memo;
      }, null);

      assert.equal(page.id, url);
      assert.equal(page.title, 'Site 1');

      var entries = events.reduce(function (memo, ev) {
        if (ev.name === 'entry') { memo.push(ev.data); }
        return memo;
      }, []);

      assert.equal(entries.length, 2);
      entries.forEach(function (entry) {
        assert.equal(entry.pageref, page.id);
      });

      done();
    });
  });
});

