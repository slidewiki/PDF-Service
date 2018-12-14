/*
Handles the requests by executing stuff and replying to the client. Uses promises to get stuff done.
*/

'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  //slideDB = require('../database/slideDatabase'), //Database functions specific for slides
  co = require('../common'),
  fs = require('fs-extra'),
  crypto = require('crypto'),
  spawn = require('child_process').spawn,
  rp = require('request-promise-native'),
  Microservices = require('../configs/microservices'),
  zip = require('adm-zip'),
  archiver = require('archiver'),
  ePub = require('epub-gen'),
  //exiftool = require('node-exiftool'),
  //exiftoolBin = require('dist-exiftool'),
  //ep = new exiftool.ExiftoolProcess(exiftoolBin),
  scraper = require('website-scraper');//,
  //Reveal = require('reveal');

let getMetadata = function(id) {
  let metadata_req_url = Microservices.deck.uri + '/deck/' + id;
  return rp(metadata_req_url).then((body) => {
    let deck_metadata = JSON.parse(body);
    let user = deck_metadata.user;
    let title = 'SlideWiki Deck ' + id;
    if (deck_metadata.revisions && deck_metadata.revisions[0] && deck_metadata.revisions[0].title) {
      title = deck_metadata.revisions[0].title;
    } else {
      title = deck_metadata.title;
    }
    console.log(JSON.stringify(body));

    // new contributors API
    return rp(Microservices.deck.uri + '/deck/' + id + '/contributors', { json: true}).then((contributors) => {
      // console.log(contributors);
      contributors = contributors.map((item) => item.id);

      let usernames_req_url = Microservices.user.uri + '/users';
      let users_options = {
        method: 'POST',
        uri: usernames_req_url,
        body: contributors,
        followAllRedirects: true,
        json: true
      };
      console.log(JSON.stringify(users_options));
      return rp(users_options).then((parsedBody) => {
        let results = {};
        results.title = title;
        results.license = deck_metadata.license;
        let usernames = [];
        for (let i = 0 ; i < parsedBody.length; i++) {//user_entry in parsedBody) {
          let user_entry = parsedBody[i];
          if (user_entry._id === user) {
            results.author = user_entry.username;
          } else {
            usernames.push(user_entry.username);
          }
        }
        if (deck_metadata.revisions && deck_metadata.revisions[0] && deck_metadata.revisions[0].theme) {
          results.theme = deck_metadata.revisions[0].theme;
        } else {
          results.theme = deck_metadata.theme;
        }
        results.contributors = usernames;
        console.log(JSON.stringify(results));
        return results;
      });
    });
  });
};

module.exports = {

  getOfflineHTML: function(request, reply) {
    let req_path = '/exportReveal/' + request.params.id + '?fullHTML=true&licensing=true';
    if (request.query.theme) {
      let theme = request.query.theme;
      req_path = req_path + '&theme=' + theme;
    }
    req_path = Microservices.pdf.uri + req_path;
    console.log(req_path);

    scraper.scrape({
      urls: [
        {url: Microservices.platform.uri + '/assets/images/cursor_bring_to_front.png', filename: 'cursor_bring_to_front.png'},
        {url: Microservices.platform.uri + '/assets/images/cursor_drag_arrow.png', filename: 'cursor_drag_arrow.png'},
        {url: Microservices.platform.uri + '/assets/images/cursor_remove.png', filename: 'cursor_remove.png'},
        {url: Microservices.platform.uri + '/assets/images/cursor_resize_arrow.png', filename: 'cursor_resize_arrow.png'},
        {url: Microservices.platform.uri + '/assets/images/cursor_send_to_back.png', filename: 'cursor_send_to_back.png'},
        {url: Microservices.platform.uri + '/assets/images/logo_full.png', filename: 'logo_full.png'},
        req_path
      ],

      directory: 'exportedOfflineHTML-' + request.params.id,
      subdirectories: [
        {directory: 'img', extensions: ['.jpg', '.png', '.svg']},
        {directory: 'js', extensions: ['.js']},
        {directory: 'css', extensions: ['.css']}
      ],
      sources: [
        {selector: 'img', attr: 'src'},
        {selector: 'link[rel="stylesheet"]', attr: 'href'},
        {selector: 'script', attr: 'src'}
      ],
      request:{
        followRedirect: true,
        followAllRedirects: true
      }

    }).then(function (result) {
      //console.log(result);
      let filename = 'slidewiki-deck-' + request.params.id + '.zip';
      let folderName = 'exportedOfflineHTML-' + request.params.id;

      // Sync:
      try {
        fs.copySync(folderName+'/img/cursor_bring_to_front.png', folderName+'/img/cursor_bring_to_front_1.png');
        fs.copySync(folderName+'/img/cursor_drag_arrow.png', folderName+'/img/cursor_drag_arrow_1.png');
        fs.copySync(folderName+'/img/cursor_remove.png', folderName+'/img/cursor_remove_1.png');
        fs.copySync(folderName+'/img/cursor_resize_arrow.png', folderName+'/img/cursor_resize_arrow_1.png');
        fs.copySync(folderName+'/img/cursor_send_to_back.png', folderName+'/img/cursor_send_to_back_1.png');
        fs.copySync(folderName+'/img/logo_full.png', folderName+'/img/logo_full_1.png');
        //console.log('success!');
      } catch (err) {
        console.error(err);
      }

      let outputArchive = fs.createWriteStream(filename);
      let archive = archiver('zip', {
        zlib: {level: 9}
      });
      //let zipFile = new zip();
      //zipFile.addLocalFolder(folderName);
      //zipFile.writeZip(filename);
      //zipFile.toBuffer(function(buffer){
      outputArchive.on('close', function() {
        reply.file(filename).header('Content-Disposition', 'attachment; filename=' + filename).header('Content-Type', 'application/zip');
      });

      archive.on('warning', function(err) {
        console.log('Archive warning ' + err);
      });

      archive.on('error', function(err) {
        console.log('Archive error ' + err);
      });

      archive.pipe(outputArchive);
      archive.directory(folderName, false);
      archive.finalize();
      //}, function(failure) {
      //  console.log(failure);
      //}
    //);
    //  reply.file(filename).header('Content-Disposition', 'attachment; filename=' + filename).header('Content-Type', 'application/zip');
    }).catch(function(err){
      console.log(err);
    });

  },

  getEPub: function(request, reply) {
    getMetadata(request.params.id).then((metadata) => {

      let copyright_slide = '<div class=\"pptx2html\" id=\"87705\" style=\"position: relative; width: 960px; height: 720px;\"><div _id=\"3\" _idx=\"1\" _name=\"Content Placeholder 2\" _type=\"body\" class=\"block content v-up context-menu-disabled\" id=\"65624\" style=\"position: absolute; top: 58.90356699625651px; left: 69.00000746532153px; width: 828px; height: 456.833px; z-index: 23520; cursor: auto;\" tabindex=\"0\"><p style=\"text-align: center;\" id=\"93898\">Author: SLIDEWIKI_AUTHOR</p><p style=\"text-align: center;\" id=\"10202\">Contributors:&nbsp;SLIDEWIKI_CONTRIBUTORS</p><p style=\"text-align: center;\" id=\"38083\">Licenced under the Creative Commons Attribution ShareAlike licence (<a href=\"http://creativecommons.org/licenses/by-sa/4.0/\" id=\"62598\">CC-BY-SA</a>)</p><p style=\"text-align: center;\" id=\"96218\">This deck was created using&nbsp;<a href=\"http://slidewiki.org\" id=\"40974\">SlideWiki</a>.</p><div class=\"h-left\" id=\"63022\">&nbsp;</div></div></div>';
      let contributor_string = '';
      for (let i = 0; i < metadata.contributors.length; i++) {
        contributor_string += metadata.contributors[i];
        if (i < metadata.contributors.length - 1) {
          contributor_string += ',';
        }
      }
      copyright_slide = copyright_slide.replace('SLIDEWIKI_CONTRIBUTORS', contributor_string).replace('SLIDEWIKI_AUTHOR', metadata.author);

      let author_string = metadata.author;
      if (metadata.contributors.length > 0) {
        author_string += ',';
      }
      for (let i = 0; i < metadata.contributors.length; i++) {
        author_string += metadata.contributors[i];
        if (i < metadata.contributors.length - 1) {
          author_string += ',';
        }
      }

      let req_path = '/deck/' + request.params.id + '/slides';
      req_path = Microservices.deck.uri + req_path;

      rp(req_path).then(function(body) {
        let deckTree = JSON.parse(body);
        let slides = [];
        if (deckTree !== '') {
          for (let i = 0; i < deckTree.children.length; i++) {
            let slide = deckTree.children[i];
            let slideContent = {
              data: slide.content

            };
            slides.push(slideContent);
          }
          let slideContent = {
            data: copyright_slide
          };
          slides.push(slideContent);
        }

        let css = 'div {' +
            '    font-size: 12pt!important;' +
            '}' +
            'span {' +
            '    font-size: 12pt!important;' +
            '}' +
            'div font {' +
            '    font-size: inherit;' +
            '}' +
            '.epub-author {' +
            '    color: #555;' +
            '}' +
            '.epub-link {' +
            '    margin-bottom: 30px;' +
            '}' +
            '.epub-link a {' +
            '    color: #666;' +
            '    font-size: 90%;' +
            '}' +
            '.toc-author {' +
            '    font-size: 90%;' +
            '    color: #555;' +
            '}' +
            '.toc-link {' +
            '    color: #999;' +
            '    font-size: 85%;' +
            '    display: block;' +
            '}' +
            'hr {' +
            '    border: 0;' +
            '    border-bottom: 1px solid #dedede;' +
            '    margin: 60px 10%;' +
            '}';

        var option = {
          title: metadata.title ? metadata.title : 'SlideWiki Deck ' + request.params.id, // *Required, title of the book.
          author: author_string ? author_string : 'SlideWiki Author', // *Required, name of the author.
          includeDTDEvenInVersion3: true,
          css: css,
          content: slides
        };
        let filename = 'slidewiki-deck-' + request.params.id + '.epub';
        new ePub(option, filename).promise.then(function() {
          reply.file(filename).header('Content-Disposition', 'attachment; filename=' + filename).header('Content-Type', 'application/epub+zip');
        }, function(err) {
          request.log(err);
          reply(boom.badImplementation());
        });
      });
    });
  },

  // Get given deck as reveal.js, or return NOT FOUND
  getReveal: function(request, reply) {
    //console.log('In getReveal');
    let req_path = '/deck/' + request.params.id + '/slides';
    let limit = request.query.limit ? 'limit=' + request.query.limit : '';
    let offset = request.query.offset ? 'offset=' + request.query.offset : '';
    let theme = request.query.theme ? request.query.theme : 'default';
    let licensing = request.query.licensing ? request.query.licensing : 'false';
    let pdfFormatting = request.query.pdfFormatting ? true : false;
    if (limit !== '' && offset !== '') {
      req_path += '?' + limit + '&' + offset;
    } else if (limit !== '') {
      req_path += '?' + limit;
    } else if (offset !== '') {
      req_path += '?' + offset;
    }
    req_path = Microservices.deck.uri + req_path;
    let platform_path = Microservices.platform.uri;
    //console.log('req_path: ' + req_path);
    getMetadata(request.params.id).then((metadata) => {
      //"title": "Copyright and Licensing",
      let copyright_slide = '<div class=\"pptx2html\" id=\"87705\" style=\"position: relative; width: 960px; height: 720px;\"><div _id=\"3\" _idx=\"1\" _name=\"Content Placeholder 2\" _type=\"body\" class=\"block content v-up context-menu-disabled\" id=\"65624\" style=\"position: absolute; top: 58.90356699625651px; left: 69.00000746532153px; width: 828px; height: 456.833px; z-index: 23520; cursor: auto;\" tabindex=\"0\"><p style=\"text-align: center;\" id=\"93898\">Author: SLIDEWIKI_AUTHOR</p><p style=\"text-align: center;\" id=\"10202\">SLIDEWIKI_CONTRIBUTORS</p><p style=\"text-align: center;\" id=\"38083\">Licenced under the Creative Commons Attribution ShareAlike licence (<a href=\"http://creativecommons.org/licenses/by-sa/4.0/\" id=\"62598\">CC-BY-SA</a>)</p><p style=\"text-align: center;\" id=\"96218\">This deck was created using&nbsp;<a href=\"http://slidewiki.org\" id=\"40974\">SlideWiki</a>.</p><div class=\"h-left\" id=\"63022\">&nbsp;</div></div></div>';
      let contributor_string = '';
      for (let i = 0; i < metadata.contributors.length; i++) {
        contributor_string += metadata.contributors[i];
        if (i < metadata.contributors.length - 1) {
          contributor_string += ',';
        }
      }
      if (contributor_string) {
        contributor_string = 'Contributors:&nbsp;' + contributor_string;
      }
      copyright_slide = copyright_slide.replace('SLIDEWIKI_CONTRIBUTORS', contributor_string).replace('SLIDEWIKI_AUTHOR', metadata.author);

      if (theme === '' && metadata.theme) {
        theme = metadata.theme;
        req_path += limit !== '' ? '&' : '?';
        req_path += 'theme=' + theme;
      }
      rp(req_path).then(function(body) {
        let deckTree = JSON.parse(body);
        //request.log(deckTree);
        if (deckTree.theme && theme === '') {
          theme = deckTree.theme;
          console.log('theme: ' + theme);
        }
        console.log('theme: ' + theme);
        let slides = [];
        if (deckTree !== '') {
          //console.log('deckTree is non-empty: ' + deckTree.children.length);
          for (let i = 0; i < deckTree.children.length; i++) {
            let slide = deckTree.children[i];
            //console.log(slide);
            let slideTitleAttribute = slide.title ? 'data-menu-item="'+ slide.title + '"' : '';
            let speakerNotes = slide.speakernotes ? '<aside class="notes">' + slide.speakernotes + '</aside>': '';
            let content = slide.content + speakerNotes ;
            slides.push('<section key="' + slide.id + '" id="' + slide.id + '" ' + slideTitleAttribute + '>' + content + '</section>');
            //console.log('slide: ' + slides[i]);

          }
          if (licensing) {
            slides.push('<section>' + copyright_slide + '</section>');
          }
        } else {
          slides = '<section/>';
        }
        let defaultCSS = '{' +
        //  'height: \'auto\',' +
          //'max-width: \'100%\',' +
          'position: \'absolute\',' +
          'top: \'0\',' +
        '}';
        let revealSlides = '';
        let pdfFormattingString;
        if (pdfFormatting) {
          pdfFormattingString = '<link rel="stylesheet" href="' + platform_path + '/custom_modules/reveal.js/css/print/pdf.css">\n';
        } else {
          pdfFormattingString = '';
        }
        if (request.query.fullHTML) {
          revealSlides += '<html>\n' +
          '<head>\n' +
          '<link rel="stylesheet" href="' + platform_path + '/custom_modules/reveal.js/css/reveal.css">\n' +
          '<link rel="stylesheet" href="' + platform_path + '/custom_modules/reveal.js/css/theme/' + theme + '.css">\n' +
          pdfFormattingString +
          '<style>\n' +
          'img {\n' +
          //'height: auto; /* Make sure images with WordPress-added height and width attributes are scaled correctly */' +
          'max-width: 100%; /* Prevent images from overflowing their boundaries */' +
          '}' +
          //'section {\n' +
          //'height: 100%; ' +
          //'max-width: 100%;' +
          //'}' +
          /*'.present {' +
            'transform: scale(0.59248, 0.59248);' +
            'transform-origin: left top;' +
          '}'+*/
          '</style>\n' +
          '</head>\n' +
          '<body>\n'; // height="960" width="700">\n';
          if (pdfFormatting) {
            revealSlides += '<script   src="https://code.jquery.com/jquery-3.2.1.min.js"   integrity="sha256-hwg4gsxgFZhOsEEamdOYGBf13FyQuiTwlAQgxVSNgt4="   crossorigin="anonymous"></script>\n';
          }
        }
        revealSlides += '<div>\n'+
        '          <div class="reveal" className="reveal" style=' + defaultCSS + '>' +// style=' + defaultCSS + '>\n' +
        '            <div class="slides" className="slides">\n'; //style="transform: scale(0.59248, 0.59248); transform-origin: left top;"
        //console.log('revealSlides: ' + revealSlides);

        for (let i = 0; i < slides.length; i++) {
          //console.log('revealSlides: ' + revealSlides);
          revealSlides += '              ' + slides[i] + '\n';
        }
        revealSlides += '            </div>' +
          '          </div>' +
          '          <br>' + //style={clear: \'both\'}/>' +
          '        </div>';
        if (request.query.fullHTML) {
          revealSlides += '<script src="' + platform_path +'/custom_modules/reveal.js/js/reveal.js"></script>' +
            '<script>' +
            '    window.onload = function() {' +
            '      var all = document.getElementsByTagName("div");' +
            '      for(i=0; i < all.length; i++) {' +
            '        if ($(all[i]).html().trim().length < 1) {' +
            '          all[i].innerHTML="";' +
            '        }' +
            '        };' +
            '    };' +
            '</script>' +
            '<script>' +
            '    var pptxwidth = 0;' +
            '    var pptxheight = 0;' +
            '    var elements = document.getElementsByClassName(\'pptx2html\');' +
            '    for (var i=0; i < elements.length; i++) {' +
            '     var eltWidth=parseInt(elements[i].style.width.replace(\'px\', \'\'));' +
            '     var eltHeight=parseInt(elements[i].style.height.replace(\'px\', \'\'));' +
            '     if (eltWidth > pptxwidth) {' +
            '       pptxwidth = eltWidth;' +
            '     }' +
            '     if (eltHeight > pptxheight) {' +
            '       pptxheight = eltHeight;' +
            '     }' +
            '    }' +
            '    if (pptxwidth !== 0 && pptxheight !== 0) {' +
            '     Reveal.initialize({' +
            '       width: pptxwidth,' +
            '       height: pptxheight,' +
            '     });' +
            '    } else {' +
          //  '       Reveal.initialize();\n' +
            '     Reveal.initialize({' +
            '       width: \'100%\',' +
            '       height: \'100%\',' +
            '     });' +
            '    }' +
            '</script>' +
            '</body>' +
            '</html>';
        }
        //request.log('revealSlides: ' + revealSlides);
        //console.log(revealSlides);
        reply(revealSlides);
      }).catch(function(error) {
        request.log('error', error);
        //console.log(error);
        reply(boom.badImplementation());
      });
    });
  },

  //Get SCORM version
  getSCORM: function(request, reply) {
    let offline = false;
    let format = 'xml';
    let version = '1.2';
    if (request.query) {
      offline = request.query.offline ? request.query.offline : false;
      format = request.query.format ? request.query.format : 'xml';
      version = request.query.version ? request.query.version : '1.2';
    }
    let id = request.params.id;
    let template = '';
    let scormFile = 'scormtemplates/imsmanifest1.xml';
    if(version === '1.2'){
      scormFile = 'scormtemplates/imsmanifest1.xml';
    }
    if(version === '2'){
      scormFile = 'scormtemplates/imsmanifest2.xml';
    }
    if(version === '3'){
      scormFile = 'scormtemplates/imsmanifest3.xml';
    }
    if(version === '4'){
      scormFile = 'scormtemplates/imsmanifest4.xml';
    }

    let req_url = Microservices.deck.uri + '/deck/' + id + '/revisionCount';
    rp(req_url).then(function(body) {
      let revision_count=body;
      let req_url = Microservices.deck.uri + '/deck/' + id;
      rp(req_url).then(function(body) {
        let deck_metadata = JSON.parse(body);
        let description = deck_metadata.description;
        let revisions = deck_metadata.revisions;
        let title = '';
        if (revisions) {
          for (let i = 0; i < revisions.length; i++) {
            if (revisions[i].id === revision_count) {
              title = revisions[i].title;
            }
          }
        } else {
          title = deck_metadata.title;
        }
        let presentation_uri = 'index.html';
          //template = template.replace(/SLIDEWIKI_PRESENTATION_URL/g, presentation_uri).replace(/SLIDEWIKI_TITLE/g, title).replace(/SLIDEWIKI_DESCRIPTION/g, description);
        fs.readFile(scormFile, function(err, data) {
          template = data+'\n\t\t\t<title>'+title+'</title>';
        });

        let outputFilename = 'slidewiki-scorm-deck-' + id + '.zip';
        let zipURI = Microservices.pdf.uri + '/exportOfflineHTML/' + id;
        let file = fs.createWriteStream(outputFilename);
        let zipReq = rp(zipURI).on('error', function (err) {
          fs.unlink(outputFilename); // Delete the file async. (But we don't check the result)
          reply(boom.badImplementation());
        }).pipe(file);
        file.on('finish', function() {
          file.close(function() {
            let zfile = new zip(outputFilename);
            zfile.extractAllTo('exportedOfflineHTML-temp-' + id, /*overwrite*/true);
            //let zfile = new zip();
            let zipEntries = zfile.getEntries();
            let index=0;
            zipEntries.forEach(function(zipEntry) {
              template +=
              '\n\t\t\t<item identifier=”I_SC'+index+'" identifierref=”SC'+index+'" isvisible=”true”>'+
                '\n\t\t\t\t<title>'+zipEntry.entryName+'</title>'+
                '\n\t\t\t</item>';
              index++;
            });

            template +='\n\t\t</organization>\n\t</organizations>\n\t<resources>';
            index=0;
            zipEntries.forEach(function(zipEntry) {
              template +=
              '\n\t\t<resource identifier="r'+index+'" type="webcontent" adlcp:scormtype="sco" href="'+zipEntry.entryName+'">'+
              '\n\t\t\t<file href="'+zipEntry.entryName+'"/>'+
                '\n\t\t</resource>';
              index++;
            });
            template +='\n\t</resources>\n</manifest>';
              //console.log("template="+template);
            let outputArchive = fs.createWriteStream('temp-' + outputFilename);
            let archive = archiver('zip', {
              zlib: { level: 9}
            });

            archive.on('warning', function(err) {
              console.log('Archive warning ' + err);
            });

            archive.on('error', function(err) {
              console.log('Archive error ' + err);
            });

            archive.pipe(outputArchive);
            //zfile.addLocalFolder('exportedOfflineHTML-temp-' +id );
            archive.directory('exportedOfflineHTML-temp-' + id + '/', false);
            archive.append(template, { name: 'imsmanifest.xml'});
            //zfile.addFile('imsmanifest.xml', template);

            if(version === '1.2') {
              archive.directory('scorm1.2', false);
            }
              //zfile.addLocalFolder('scorm1.2');
            if(version === '2') {
              archive.directory('scorm2', false);
            }
              //zfile.addLocalFolder('scorm2');
            if(version === '3') {
              archive.directory('scorm3', false);
            }
            //zfile.addLocalFolder('scorm3');
            if(version === '4') {
              archive.directory('scorm4', false);
            }
              //zfile.addLocalFolder('scorm4');
            outputArchive.on('close', function() {
              reply.file('temp-' + outputFilename).header('Content-Disposition', 'attachment; filename=' + outputFilename).header('Content-Type', 'application/zip');
            });


            archive.finalize();

            //zfile.toBuffer( function(buffer) {
            //  reply(buffer).header('Content-Disposition', 'attachment; filename=' + outputFilename).header('Content-Type', 'application/zip');
            //}, function(failure) {
            //  reply(boom.badImplementation());
            //});
          });
        });
      }).catch(function(error) { // Handle errors
        console.log(error);
        fs.unlink('temp' + outputFilename); // Delete the file async. (But we don't check the result)
        reply(boom.badImplementation());
      });
    }).catch(function(error) {
      request.log(error);
      reply(boom.badImplementation());//2480 3508
    });
  },

  //Get PDF from URL or return NOT FOUND
  getPDF: function(request, reply) {
    let id = request.params.id;
    let url = Microservices.pdf.uri + '/exportReveal/' + id + '?fullHTML=true&pdfFormatting=true';

    //let md5sum = crypto.createHash('md5');
    //md5sum.update(url);
    let filename = 'slidewiki-deck-' + id + '.pdf';//md5sum.digest('base64') + '.pdf';

    let command = request.query.command ? request.query.command : 'reveal';
    let size = request.query.slideSize ? request.query.slideSize : '2880x2100';//3 * 960 x 700
    let slides = request.query.slides ? request.query.slides : '';
    let outputFilename = request.query.pdf ? request.query.pdf : 'slidewiki-deck-' + id + '.pdf';
    let decktapeArgs = ['node_modules/decktape/decktape.js', '--no-sandbox'];
    if ( size !== '') {
      decktapeArgs.push('--size', size);
    }
    if ( slides !== '') {
      decktapeArgs.push('--slides', slides);
    }
    decktapeArgs.push(command);
    decktapeArgs.push(url);
    decktapeArgs.push(filename);

    let decktape = spawn('node', decktapeArgs);//spawn('decktape/bin/phantomjs', decktapeArgs);
    console.log(decktapeArgs);
    decktape.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });

    decktape.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`);
    });

    decktape.on('close', (code) => {
      reply.file(filename).header('Content-Disposition', 'attachment; filename=' + outputFilename).header('Content-Type', 'application/pdf');
      //console.log('FILENAME: ' + filename);
      /*getMetadata(id).then((metadata) => {
        let contributor_string = '';
        for (let i = 0; i < metadata.contributors.length; i++) {
          contributor_string += metadata.contributors[i];
          if (i == metadata.contributors.length - 1 ) {
            contributor_string += ',';
          }
        }
        ep.open().then( () => { ep.writeMetadata(filename,
          {
              'XMP-dc:Creator': metadata.author,
              'XMP-dc:Contributor': contributor_string,
              'XMP-dc:Rights' : 'http://creativecommons.org/licenses/by/sa',
              'XMP-dc:Identifier': Microservices.platform.uri + '/Presentation/' + id,
              'XMP-xmp:Creator Tool' : Microservices.platform.uri
          },
          ['overwrite_original']).then( () => {
            ep.close();
            reply.file(filename).header('Content-Disposition', 'attachment; filename=' + outputFilename).header('Content-Type', 'application/pdf');
        })});
      });*/
      decktape.kill();
    });

  },

  getPDFEnd : function(request) {
    if (request.params.id) {
      let id = request.params.id;
      let url = Microservices.pdf.uri + '/exportReveal/' + id + '?fullHTML=true';
      if (request.path.includes('exportPDF')) {
        //let md5sum = crypto.createHash('md5');
        //md5sum.update(url);
        let filename = 'slidewiki-deck-' + id + '.pdf';//md5sum.digest('base64') + '.pdf';
        fs.unlinkSync(filename);
      }
      if (request.path.includes('exportOfflineHTML')) {
        //let md5sum = crypto.createHash('md5');
        //md5sum.update(url);
        //let filename = 'slidewiki-deck-' + id + '.zip';//md5sum.digest('base64') + '.pdf';
        //fs.unlinkSync(filename);
        fs.removeSync('exportedOfflineHTML-' + id);
      }
      if (request.path.includes('exportSCORM')) {
        let filename = 'slidewiki-scorm-deck-' + id + '.zip';
        fs.unlinkSync(filename);
        fs.removeSync('exportedOfflineHTML-temp-' + id);
      }
      if (request.path.includes('exportEPub')) {
        let filename = 'slidewiki-deck-' + id + '.epub';
        fs.unlinkSync(filename);
      }

    }
  }
};
