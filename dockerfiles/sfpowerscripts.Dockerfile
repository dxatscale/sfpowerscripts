FROM heroku/heroku:20

ENV DEBIAN_FRONTEND=noninteractive
ARG SFPOWERSCRIPTS_VERSION=alpha
ARG GIT_COMMIT


# Create symbolic link from sh to bash
ENV SHELL /bin/bash

# Install NODE
RUN echo 'a0f23911d5d9c371e95ad19e4e538d19bffc0965700f187840eb39a91b0c3fb0  ./nodejs.tar.gz' > node-file-lock.sha \
  && curl -s -o nodejs.tar.gz https://nodejs.org/dist/v16.13.2/node-v16.13.2-linux-x64.tar.gz \
  && shasum --check node-file-lock.sha
RUN mkdir /usr/local/lib/nodejs \
  && tar xf nodejs.tar.gz -C /usr/local/lib/nodejs/ --strip-components 1 \
  && rm nodejs.tar.gz node-file-lock.sha


# Install OpenJDK-11
RUN apt-get update && apt-get install --assume-yes openjdk-11-jdk-headless jq
RUN apt-get autoremove --assume-yes \
     && apt-get clean --assume-yes \
     && rm -rf /var/lib/apt/lists/*


# ReInstall Python make and g++ for node-gyp rebuild
RUN apt-get update && apt-get install -qq software-properties-common && \
    add-apt-repository ppa:deadsnakes/ppa && \
    apt-get update -qq && \
    DEBIAN_FRONTEND=noninteractive \
    apt-get install -qq python3.8 make  g++ && \
    apt-get clean -qq 

# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chromium that Puppeteer
# installs, work.
RUN apt-get update \
    && apt-get install -y  gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*


# Set XDG environment variables explicitly so that GitHub Actions does not apply
# default paths that do not point to the plugins directory
# https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html
ENV XDG_DATA_HOME=/sfdx_plugins/.local/share
ENV XDG_CONFIG_HOME=/sfdx_plugins/.config
ENV XDG_CACHE_HOME=/sfdx_plugins/.cache

# Create isolated plugins directory with rwx permission for all users
# Azure pipelines switches to a container-user which does not have access
# to the root directory where plugins are normally installed
RUN mkdir -p $XDG_DATA_HOME && \
    mkdir -p $XDG_CONFIG_HOME && \
    mkdir -p $XDG_CACHE_HOME && \
    chmod -R 777 sfdx_plugins

RUN export XDG_DATA_HOME && \
    export XDG_CONFIG_HOME && \
    export XDG_CACHE_HOME


ENV PATH=/usr/local/lib/nodejs/bin:$PATH
RUN npm install --global sfdx-cli@7.144.0 --ignore-scripts
RUN  npm -g install vlocity@1.15.2
# Install sfdx plugins
RUN echo 'y' | sfdx plugins:install sfdx-browserforce-plugin@2.8.0
RUN echo 'y' | sfdx plugins:install sfdmu@4.13.0
RUN echo 'y' | sfdx plugins:install sfpowerkit@4.1.5
RUN echo 'y' | sfdx plugins:install @dxatscale/sfpowerscripts@$SFPOWERSCRIPTS_VERSION



ENV SFDX_CONTAINER_MODE true
ENV DEBIAN_FRONTEND=dialog


#Add Labels
LABEL org.opencontainers.image.description "sfpowerscripts is a build system for modular development in Salesforce, its delivered as a sfdx plugin that can be implemented in any CI/CD system of choice"
LABEL org.opencontainers.image.licenses "MIT"
LABEL org.opencontainers.image.url "https://github.com/Accenture/sfpowerscripts"
LABEL org.opencontainers.image.documentation "https://docs.dxatscale.io/projects/sfpowerscripts"
LABEL org.opencontainers.image.revision $GIT_COMMIT
LABEL org.opencontainers.image.vendor "DX@Scale"
LABEL org.opencontainers.image.source "https://github.com/Accenture/sfpowerscripts"
