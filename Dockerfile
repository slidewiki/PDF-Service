FROM node:6.9-slim
MAINTAINER Roy Meissner <meissner@informatik.uni-leipzig.de>

RUN mkdir /nodeApp
WORKDIR /nodeApp

# ---------------- #
#   Installation   #
# ---------------- #
RUN apt-get update
RUN apt-get install -y git libsqlite3-0 libfontconfig1


RUN git clone --depth 1 https://github.com/astefanutti/decktape.git
ADD http://astefanutti.github.io/decktape/downloads/phantomjs-linux-ubuntu16-x86-64 ./decktape/bin/phantomjs
RUN chmod 700 ./decktape/bin/phantomjs


ADD ./application/package.json ./
RUN npm install --production
RUN npm install git+https://github.com/athird/epub-gen.git

ADD ./application/ ./

# ----------------- #
#   Configuration   #
# ----------------- #

EXPOSE 80

# ----------- #
#   Cleanup   #
# ----------- #

RUN apt-get autoremove -y && apt-get -y clean && \
		rm -rf /var/lib/apt/lists/*

# -------- #
#   Run!   #
# -------- #

CMD npm start
