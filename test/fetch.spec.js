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

  it('should', function (done) {
    fetch('http://127.0.0.1:12345/', function (err, data) {
      //console.log(err, data);
      done();
    });
  });

  /*
  it('should throw when url is not a string', function () {
    assert.throws(function () {
      fetch();
    }, function (err) {
      assert.ok(err instanceof TypeError);
      return /'url' must be a string/i.test(err.message)
    });
  });

  it('should..', function () {
    fetch('foo');
  });
  */

});

