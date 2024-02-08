FROM ubuntu:22.04


ARG SFPOWERSCRIPTS_VERSION=alpha
ARG SF_CLI_VERSION=2.25.7 
ARG BROWSERFORCE_VERSION=4.0.0
ARG SFDMU_VERSION=4.32.2
ARG GIT_COMMIT
ARG NODE_MAJOR=18

LABEL org.opencontainers.image.description "sfp is a build system for modular development in Salesforce."
LABEL org.opencontainers.image.licenses "MIT"
LABEL org.opencontainers.image.url "https://github.com/flxbl-io/sfp"
LABEL org.opencontainers.image.documentation "https://docs.flxbl.io/sfp"
LABEL org.opencontainers.image.revision $GIT_COMMIT
LABEL org.opencontainers.image.vendor "Flxbl"
LABEL org.opencontainers.image.source "https://github.com/flxbl-io/sfp"
LABEL org.opencontainers.image.title "Flxbl sfp docker image - February 24"


ENV DEBIAN_FRONTEND=noninteractive


RUN ln -sf bash /bin/sh


RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get -y install --no-install-recommends \
      git \
      curl \
      sudo \
      jq \
      zip \
      unzip \
      make \
      g++ \
      tzdata \
      openjdk-17-jre-headless \
      ca-certificates \
	  libxkbcommon-x11-0 libdigest-sha-perl  libxshmfence-dev \
       gconf-service libappindicator1 libasound2 libatk1.0-0 \
       libatk-bridge2.0-0 libcairo-gobject2 libdrm2 libgbm1 libgconf-2-4 \
       libgtk-3-0 libnspr4 libnss3 libx11-xcb1 libxcb-dri3-0 libxcomposite1 libxcursor1 \
       libxdamage1 libxfixes3 libxi6 libxinerama1 libxrandr2 libxshmfence1 libxss1 libxtst6 \
       fonts-liberation fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
      chromium-bsu \
      chromium-driver \
      gnupg \
    && apt-get autoremove --assume-yes \
    && apt-get clean --assume-yes \
    && rm -rf /var/lib/apt/list/*

# Set timezone to UTC
ENV TZ=UTC
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# install nodejs via nodesource
RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get -y install --no-install-recommends nodejs \
    && apt-get autoremove --assume-yes \
    && apt-get clean --assume-yes \
    && rm -rf /var/lib/apt/list/*    

# install yarn
RUN npm install --global yarn --omit-dev \
    && npm cache clean --force

# Install SF cli and sfpowerscripts
RUN npm install --global --omit=dev \
    @salesforce/cli@${SF_CLI_VERSION} \
    @flxblio/sfp@${SFPOWERSCRIPTS_VERSION} \
    && npm cache clean --force



# Set XDG environment variables explicitly so that GitHub Actions does not apply
# default paths that do not point to the plugins directory
# https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html
ENV XDG_DATA_HOME=/sf_plugins/.local/share \
    XDG_CONFIG_HOME=/sf_plugins/.config  \
    XDG_CACHE_HOME=/sf_plugins/.cache \
    JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64/ \
    PUPPETEER_CACHE_DIR=/root/.cache/puppeteer


# Create symbolic link from sh to bash
# Create isolated plugins directory with rwx permission for all users
# Azure pipelines switches to a container-user which does not have access
# to the root directory where plugins are normally installed
RUN mkdir -p $XDG_DATA_HOME && \
    mkdir -p $XDG_CONFIG_HOME && \
    mkdir -p $XDG_CACHE_HOME && \
    chmod -R 777 sf_plugins && \
    export JAVA_HOME && \
    export XDG_DATA_HOME && \
    export XDG_CONFIG_HOME && \
    export XDG_CACHE_HOME



# Install sfdx plugins
RUN echo 'y' | sf plugins:install sfdx-browserforce-plugin@${BROWSERFORCE_VERSION} \
    && echo 'y' | sf plugins:install sfdmu@${SFDMU_VERSION} \
    && echo 'y' | sf plugins:install @salesforce/plugin-signups@1.5.0 \
    && echo 'y' | sf plugins:install @salesforce/sfdx-scanner@3.16.0 \
    && yarn cache clean --all 

# Set some sane behaviour in container
ENV SF_CONTAINER_MODE=true
ENV SF_DISABLE_AUTOUPDATE=true
ENV SF_DISABLE_TELEMETRY=true
ENV SF_USE_GENERIC_UNIX_KEYCHAIN=true
ENV SF_USE_PROGRESS_BAR=false
ENV SF_DNS_TIMEOUT=60000
ENV SF_SKIP_VERSION_CHECK=true
ENV SF_SKIP_NEW_VERSION_CHECK=true

WORKDIR /root



# clear the entrypoint for azure
ENTRYPOINT []
CMD ["/bin/sh"]
