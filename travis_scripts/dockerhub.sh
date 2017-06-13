#!/bin/bash

docker login -u="$DOCKER_USERNAME" -p="$DOCKER_PASSWORD"
docker build -t slidewiki/pdfservice:latest-dev ./
docker push slidewiki/pdfservice:latest-dev
