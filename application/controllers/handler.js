/*
Handles the requests by executing stuff and replying to the client. Uses promises to get stuff done.
*/

'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  //slideDB = require('../database/slideDatabase'), //Database functions specific for slides
  co = require('../common'),
  fs = require('fs'),
  crypto = require('crypto'),
  spawn = require('child_process').spawn,
  rp = require('request-promise'),
  http = require('http');//,
  //Reveal = require('reveal');

module.exports = {
  // Get given deck as reveal.js, or return NOT FOUND
  getReveal: function(request, reply) {
    //console.log('In getReveal');
    let req_path = '/deck/' + request.params.id + '/slides';
    let limit = request.query.limit ? 'limit=' + request.query.limit : '';
    let offset = request.query.offset ? 'offset=' + request.query.offset : '';
    if (limit !== '' && offset !== '') {
      req_path += '?' + limit + '&' + offset;
    } else if (limit != '') {
      req_path += '?' + limit;
    } else if (offset != '') {
      req_path += '?' + offset;
    }
    req_path = 'http://deckservice.manfredfris.ch' + req_path;
    //console.log('req_path: ' + req_path);

    rp(req_path).then(function(body) {
      let deckTree = JSON.parse(body);
      //console.log(deckTree);
      let slides = [];
      if (deckTree != '') {
        //console.log('deckTree is non-empty: ' + deckTree.children.length);
        for (let i = 0; i < deckTree.children.length; i++) {
          let slide = deckTree.children[i];
          //console.log(slide);
          let speakerNotes = slide.speakerNotes ? '<aside class="notes">' + slide.speakerNotes + '</aside>': '';
          let content = slide.title + slide.content + speakerNotes ;
          slides.push('<section key="' + slide.id + '" id="' + slide.id + '">' + content + '</section>');
          //console.log('slide: ' + slides[i]);

        }
      } else {
        slides = '<section/>';
      }
      let defaultCSS = '{' +
        'height: \'100%\',' +
        'fontSize: \'100%\',' +
        'position: \'absolute\',' +
        'top: \'0\',' +
        '//backgroundColor: \'#ffffff\',' +
        'zindex: \'1000\'' +
      '}';
      let revealSlides = '';
      if (request.query.fullHTML) {
        revealSlides += '<html>\n' +
        '<head>\n' +
        '<link rel="stylesheet" href="http://lab.hakim.se/reveal-js/css/reveal.css">\n' +
        '<link rel="stylesheet" href="http://lab.hakim.se/reveal-js/css/theme/white.css">\n' +
        '</head>\n' +
        '<body>\n';
      }
      revealSlides += '<div>\n'+
      '          <div class="reveal" className="reveal" style=' + defaultCSS + '>\n' +
      '            <div class="slides" className="slides">\n';
      //console.log('revealSlides: ' + revealSlides);
      for (let i = 0; i < slides.length; i++) {
        //console.log('revealSlides: ' + revealSlides);
        revealSlides += '              ' + slides[i] + '\n';
      }
      revealSlides += '            </div>' +
        '          </div>' +
        '          <br style={clear: \'both\'}/>' +
        '        </div>';
      if (request.query.fullHTML) {
        revealSlides += '<script src="http://lab.hakim.se/reveal-js/js/reveal.js"></script>' +
          '<script>' +
          '    Reveal.initialize();' +
          '</script>' +
          '</body>' +
          '</html>';
        }
      //console.log('revealSlides: ' + revealSlides);
      //console.log(revealSlides);
      reply(revealSlides);
    }).catch(function(error) {
      request.log('error', error);
      //console.log(error);
      reply(boom.badImplementation());
    });
  },

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
    //console.log(decktapeArgs);
    decktape.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });

    decktape.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`);
    });

    decktape.on('close', (code) => {
      console.log('FILENAME: ' + filename);
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
