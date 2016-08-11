/*
Handles the requests by executing stuff and replying to the client. Uses promises to get stuff done.
*/

'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  //slideDB = require('../database/slideDatabase'), //Database functions specific for slides
  co = require('../common'),
  fs = require('fs'),
  crypto = require('crypto'),
  spawn = require('child_process').spawn;

module.exports = {
  //Get PDF from URL or return NOT FOUND
  getPDF: function(request, reply) {
    let md5sum = crypto.createHash('md5');
    md5sum.update(request.params.url);
    let filename = md5sum.digest('base64') + '.pdf';

    let command = request.query.command ? request.query.command : 'reveal';
    let url = request.params.url;
    let size = request.query.slideSize ? request.query.slideSize : '';
    let slides = request.query.slides ? request.query.slides : '';
    let outputFilename = request.query.pdf ? request.query.pdf : filename;
    let decktapeArgs = ['decktape/decktape.js'];
    if ( size !== '') {
      decktapeArgs.push('--size', size);
    }
    if ( slides !== '') {
      decktapeArgs.push('--slides', slides);
    }
    decktapeArgs.push(command);
    decktapeArgs.push(url);
    decktapeArgs.push(filename);

    let decktape = spawn('decktape/bin/phantomjs', decktapeArgs);
    console.log(decktapeArgs);
    decktape.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });

    decktape.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`);
    });

    decktape.on('close', (code) => {
      reply.file(filename).header('Content-Disposition', 'attachment; filename=' + outputFilename).header('Content-Type', 'application/pdf');
    });

  },
  getPDFEnd : function(request) {
    if (request.params.url) {
      let url = request.params.url;
      if (request.path.includes('exportPDF')) {
        let md5sum = crypto.createHash('md5');
        md5sum.update(url);
        let filename = md5sum.digest('base64') + '.pdf';
        fs.unlinkSync(filename);
      }
    }
  }
};
