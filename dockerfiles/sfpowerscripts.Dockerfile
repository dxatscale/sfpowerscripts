FROM heroku/heroku:20


ENV DEBIAN_FRONTEND=noninteractive
ARG SFPOWERSCRIPTS_VERSION=alpha

ARG PMD_VERSION=${PMD_VERSION:-6.39.0}
ARG SFPOWERSCRIPTS_VERSION=alpha
ARG GIT_COMMIT


# Create symbolic link from sh to bash
RUN ln -sf bash /bin/sh

# Install Common packages
RUN apt-get update && \
    apt-get install -qq \
        curl \
        sudo \
        jq \
        zip \
        unzip \
	      make \
        g++ \
        wget \
        gnupg \
	      libxkbcommon-x11-0 \
        libdigest-sha-perl \
        libxshmfence-dev \
  &&   apt-get autoremove --assume-yes \
  && apt-get clean --assume-yes \
  && rm -rf /var/lib/apt/lists/*

# Install NODE 16
RUN echo 'a0f23911d5d9c371e95ad19e4e538d19bffc0965700f187840eb39a91b0c3fb0  ./nodejs.tar.gz' > node-file-lock.sha \
  && curl -s -o nodejs.tar.gz https://nodejs.org/dist/v16.13.2/node-v16.13.2-linux-x64.tar.gz \
  && shasum --check node-file-lock.sha
RUN mkdir /usr/local/lib/nodejs \
  && tar xf nodejs.tar.gz -C /usr/local/lib/nodejs/ --strip-components 1 \
  && rm nodejs.tar.gz node-file-lock.sha
ENV PATH=/usr/local/lib/nodejs/bin:$PATH


# Install OpenJDK-11
RUN apt-get update && apt-get install --assume-yes openjdk-11-jdk-headless\ 
     && apt-get autoremove --assume-yes \
     && apt-get clean --assume-yes \
     && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64/
RUN export JAVA_HOME





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

# Install Yarn
RUN npm install --global yarn

# Install sfdx-cli
RUN yarn global add sfdx-cli@7.145.0 

# Install vlocity
RUN yarn global add vlocity@1.15.2

#Install Puppeteer
RUN yarn global add puppeteer@10.4.0

# Install all shared dependencies for chrome and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chromium that Puppeteer
# installs, work.
RUN apt-get update && apt-get install -qq gconf-service libappindicator1 libasound2 libatk1.0-0 \
                   && apt-get install -qq libatk-bridge2.0-0 libcairo-gobject2 libdrm2 libgbm1 libgconf-2-4 \
                   && apt-get install -qq libgtk-3-0 libnspr4 libnss3 libx11-xcb1 libxcb-dri3-0 libxcomposite1 libxcursor1 \
                   && apt-get install -qq libxdamage1 libxfixes3 libxi6 libxinerama1 libxrandr2 libxshmfence1 libxss1 libxtst6 \
                   && apt-get install -qq fonts-liberation fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
                   && apt-get autoremove --assume-yes \
                   && apt-get clean --assume-yes \
                   && rm -rf /var/lib/apt/lists/*



# Install PMD
RUN mkdir -p $HOME/sfpowerkit
RUN cd $HOME/sfpowerkit \
      && wget -nc -O pmd.zip https://github.com/pmd/pmd/releases/download/pmd_releases/${PMD_VERSION}/pmd-bin-${PMD_VERSION}.zip \
      && unzip pmd.zip \
      && rm -f pmd.zip 


# Install sfdx plugins
RUN echo 'y' | sfdx plugins:install sfdx-browserforce-plugin@2.8.0
RUN echo 'y' | sfdx plugins:install apexlink@2.3.2
RUN echo 'y' | sfdx plugins:install sfdmu@4.13.0
RUN echo 'y' | sfdx plugins:install sfpowerkit@4.2.5



# install sfpowerscripts
RUN echo 'y' | sfdx plugins:install @dxatscale/sfpowerscripts@$SFPOWERSCRIPTS_VERSION




#Add Labels
LABEL org.opencontainers.image.description "sfpowerscripts is a build system for modular development in Salesforce, its delivered as a sfdx plugin that can be implemented in any CI/CD system of choice"
LABEL org.opencontainers.image.licenses "MIT"
LABEL org.opencontainers.image.url "https://github.com/Accenture/sfpowerscripts"
LABEL org.opencontainers.image.documentation "https://docs.dxatscale.io/projects/sfpowerscripts"
LABEL org.opencontainers.image.revision $GIT_COMMIT
LABEL org.opencontainers.image.vendor "DX@Scale"
LABEL org.opencontainers.image.source "https://github.com/Accenture/sfpowerscripts"
LABEL org.opencontainers.image.title "DX@Scale sfpowercripts docker image - May 22"
