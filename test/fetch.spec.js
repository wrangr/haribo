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
          path: path.join(__dirname, 'sites/1')
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

});

