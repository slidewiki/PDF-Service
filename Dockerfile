FROM node:8.4-slim
MAINTAINER Roy Meissner <meissner@informatik.uni-leipzig.de>

RUN mkdir /nodeApp
WORKDIR /nodeApp

# ---------------- #
#   Installation   #
# ---------------- #
RUN apt-get update
RUN apt-get install -y git libsqlite3-0 libfontconfig1 libpangocairo-1.0-0 libX11-xcb1 libXcomposite1 libXcursor1 libatk1.0-0 libc6 libasound2 libcairo2 libcap2 libcups2 libexpat1 libffi6 libfontconfig1 libfreetype6 libglib2.0-0 libgnome-keyring0 libgtk2.0-0 libgtk-3-0 libpam0g libpango1.0-0 libpci3 libpcre3 libpixman-1-0 libspeechd2 libstdc++6 libsqlite3-0 libx11-6 libx11-xcb1 libxau6 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxdmcp6 libxext6 libxfixes3 libxi6 libxinerama1  libxrandr2   libxrender1  libxtst6 zlib1g libnss3 libXss1 libgconf-2-4


#RUN git clone --depth 1 https://github.com/astefanutti/decktape.git
#ADD http://astefanutti.github.io/decktape/downloads/phantomjs-linux-ubuntu16-x86-64 ./decktape/bin/phantomjs
#RUN chmod 700 ./decktape/bin/phantomjs

RUN wget https://github.com/Yelp/dumb-init/releases/download/v1.2.0/dumb-init_1.2.0_amd64.deb
RUN dpkg -i dumb-init_*.deb

ADD ./application/package.json ./
RUN npm install --production
RUN npm install git+https://github.com/athird/epub-gen.git

#RUN npm install git+https://github.com/athird/epub-gen.git

RUN npm install git+https://github.com/slidewiki/reveal.js.git

RUN mkdir ./reveal.js
RUN mkdir ./reveal.js-menu
RUN cp -r ./node_modules/reveal.js/css ./reveal.js
RUN cp -r ./node_modules/reveal.js/img ./reveal.js
RUN cp -r ./node_modules/reveal.js/js ./reveal.js
RUN cp -r ./node_modules/reveal.js/lib ./reveal.js
RUN cp -r ./node_modules/reveal.js/plugin ./reveal.js
RUN cp -r ./node_modules/reveal.js-menu/font-awesome ./reveal.js-menu
RUN cp -r ./node_modules/reveal.js-menu/menu.* ./reveal.js-menu
ADD https://code.jquery.com/jquery-3.2.1.min.js ./reveal.js/lib/jquery-3.2.1.min.js

ADD ./application/ ./

# ----------------- #
#   Configuration   #
# ----------------- #

EXPOSE 3000

# ----------- #
#   Cleanup   #
# ----------- #

RUN apt-get autoremove -y && apt-get -y clean && \
		rm -rf /var/lib/apt/lists/*

# -------- #
#   Run!   #
# -------- #
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["npm", "start"]
