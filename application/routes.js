/*
These are routes as defined in https://docs.google.com/document/d/1337m6i7Y0GPULKLsKpyHR4NRzRwhoxJnAZNnDFCigkc/edit#
Each route implementes a basic parameter/payload validation and a swagger API documentation description
*/
'use strict';

const Joi = require('joi'),
  handlers = require('./controllers/handler');

module.exports = function(server) {

  server.route({
    method: 'GET',
    path: '/exportPDF/{id}',
    handler: handlers.getPDF,
    config: {
      validate: {
        params: {
          id : Joi.string().regex(/^[0-9]+$/).required().description('SlideWiki deck id')
        },
        query: {
          command : Joi.string().valid('automatic', 'bespoke', 'csss', 'deck', 'dzslides', 'flowtime', 'generic', 'impress', 'remark', 'reveal', 'shower', 'slide').description('Decktape slide format plugin'),
          size : Joi.string().regex(/^[0-9]+x[0-9]+$/).description('Resolution for exported slides'),
          slides : Joi.string().regex(/^[0-9]+(?:-[0-9]+)?(?:,[0-9]+(?:-[0-9]+)?)*$/).description('Selection of slides to export'),
          pdf : Joi.string().regex(/^[a-zA-Z0-9_\-,]+\.pdf$/).description('Name of exported file')
        }
      },
      tags: ['api'],
      description: 'Export the deck with id {id} as a PDF.'
    }
  });

  server.route({
    method: 'GET',
    path: '/exportReveal/{id}',
    handler: handlers.getReveal,
    config: {
      validate: {
        params: {
          id: Joi.string()
        },
        query: {
          limit: Joi.string().optional(),
          offset: Joi.string().optional(),
          fullHTML: Joi.string().optional()
        }
      },
      tags: ['api'],
      description: 'Export the given deck in Reveal.js format'
    }
  });

  server.on('tail', function(request) {
    return handlers.getPDFEnd(request);
  });
};
