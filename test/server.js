'use strict';


const Path = require('path');
const Hapi = require('hapi');


exports.start = function (done) {

  const server = new Hapi.Server();

  server.connection({ port: 12345 });

  server.register(require('inert'), (err) => {

    if (err) {
      return console.error(err);
    }
  });

  server.route({
    method: 'GET',
    path: '/{p*}',
    handler: {
      directory: {
        path: Path.join(__dirname, 'sites')
      }
    }
  });

  server.route({
    method: 'GET',
    path: '/_internal_redirect',
    handler: function (req, reply) {

      reply.redirect('/01-simple');
    }
  });

  server.route({
    method: 'GET',
    path: '/_external_redirect',
    handler: function (req, reply) {

      reply.redirect('https://github.com/');
    }
  });

  server.start(done);

  return server;
};

