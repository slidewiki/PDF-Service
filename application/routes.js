/*
These are routes as defined in https://docs.google.com/document/d/1337m6i7Y0GPULKLsKpyHR4NRzRwhoxJnAZNnDFCigkc/edit#
Each route implementes a basic parameter/payload validation and a swagger API documentation description
*/
'use strict';

const Joi = require('joi'),
  handlers = require('./controllers/handler');

module.exports = function(server) {
  //Get presentation from URL and return it as a PDF. Validate url
  server.route({
    method: 'GET',
    path: '/exportPDF/{url}',
    handler: handlers.getPDF,
    config: {
      validate: {
        params: {
          url : Joi.string().uri().required().description('Reveal presentation URL')
        },
        query: {
          command : Joi.string().valid('automatic', 'bespoke', 'csss', 'deck', 'dzslides', 'flowtime', 'generic', 'impress', 'remark', 'reveal', 'shower', 'slide').description('Decktape slide format plugin'),
          size : Joi.string().regex(/^[0-9]+x[0-9]+$/).description('Resolution for exported slides'),
          slides : Joi.string().regex(/^[0-9]+(?:-[0-9]+)?(?:,[0-9]+(?:-[0-9]+)?)*$/).description('Selection of slides to export'),
          pdf : Joi.string().regex(/^[a-zA-Z0-9_\-,]+\.pdf$/).description('Name of exported file')
        }
      },
      tags: ['api'],
      description: 'Export the reveal.js presentation at {url} as a PDF.'
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
          fullHTML: Joi.boolean().optional()
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
