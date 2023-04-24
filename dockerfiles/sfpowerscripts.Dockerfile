FROM  salesforce/salesforcedx:7.186.2-full



ENV DEBIAN_FRONTEND=noninteractive
ARG SFPOWERSCRIPTS_VERSION=alpha

ARG PMD_VERSION=${PMD_VERSION:-6.48.0}
ARG SFPOWERSCRIPTS_VERSION=alpha
ARG GIT_COMMIT

# update git & common packages
# Install all shared dependencies for chrome and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chromium that Puppeteer
# installs, work.
RUN apt-get update && apt-get install -qq software-properties-common \
    && add-apt-repository ppa:git-core/ppa -y  \
    &&  apt-get install -qq   \
        git \
        curl \
        sudo \
        jq \
        zip \
        unzip \
	    make \
        g++ \
        wget \
        gnupg \
	    libxkbcommon-x11-0 libdigest-sha-perl  libxshmfence-dev \
        gconf-service libappindicator1 libasound2 libatk1.0-0 \
        libatk-bridge2.0-0 libcairo-gobject2 libdrm2 libgbm1 libgconf-2-4 \
        libgtk-3-0 libnspr4 libnss3 libx11-xcb1 libxcb-dri3-0 libxcomposite1 libxcursor1 \
        libxdamage1 libxfixes3 libxi6 libxinerama1 libxrandr2 libxshmfence1 libxss1 libxtst6 \
        fonts-liberation fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
    && apt-get autoremove --assume-yes \ 
    && apt-get clean --assume-yes  \   
    && rm -rf /var/lib/apt/lists/*


# Set XDG environment variables explicitly so that GitHub Actions does not apply
# default paths that do not point to the plugins directory
# https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html
ENV XDG_DATA_HOME=/sfdx_plugins/.local/share \
    XDG_CONFIG_HOME=/sfdx_plugins/.config  \
    XDG_CACHE_HOME=/sfdx_plugins/.cache \
    JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64/

#
# Create symbolic link from sh to bash
# Create isolated plugins directory with rwx permission for all users
# Azure pipelines switches to a container-user which does not have access
# to the root directory where plugins are normally installed
RUN ln -sf bash /bin/sh && \
    mkdir -p $XDG_DATA_HOME && \
    mkdir -p $XDG_CONFIG_HOME && \
    mkdir -p $XDG_CACHE_HOME && \
    chmod -R 777 sfdx_plugins && \
    export JAVA_HOME && \
    export XDG_DATA_HOME && \
    export XDG_CONFIG_HOME && \
    export XDG_CACHE_HOME




RUN npm install --global vlocity@1.16.1


# Install PMD
RUN mkdir -p $HOME/sfpowerkit
RUN cd $HOME/sfpowerkit \
      && wget -nc -O pmd.zip https://github.com/pmd/pmd/releases/download/pmd_releases/${PMD_VERSION}/pmd-bin-${PMD_VERSION}.zip \
      && unzip pmd.zip \
      && rm -f pmd.zip 


# Install sfdx plugins
RUN echo 'y' | sfdx plugins:install sfdx-browserforce-plugin@2.9.1
RUN echo 'y' | sfdx plugins:install sfdmu@4.18.2
RUN echo 'y' | sfdx plugins:install sfpowerkit@5.0.0
# install sfpowerscripts
RUN echo 'y' | sfdx plugins:install @dxatscale/sfpowerscripts@$SFPOWERSCRIPTS_VERSION




#Add Labels
LABEL org.opencontainers.image.description "sfpowerscripts is a build system for modular development in Salesforce, its delivered as a sfdx plugin that can be implemented in any CI/CD system of choice"
LABEL org.opencontainers.image.licenses "MIT"
LABEL org.opencontainers.image.url "https://github.com/dxatscale/sfpowerscripts"
LABEL org.opencontainers.image.documentation "https://docs.dxatscale.io/projects/sfpowerscripts"
LABEL org.opencontainers.image.revision $GIT_COMMIT
LABEL org.opencontainers.image.vendor "DX@Scale"
LABEL org.opencontainers.image.source "https://github.com/dxatscale/sfpowerscripts"
LABEL org.opencontainers.image.title "DX@Scale sfpowercripts docker image - April 23"
