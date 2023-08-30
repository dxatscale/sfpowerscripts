FROM  salesforce/cli:2.5.8-full



ENV DEBIAN_FRONTEND=noninteractive
ARG SFPOWERSCRIPTS_VERSION=alpha
ARG GIT_COMMIT

# update git & common packages
# Install all shared dependencies for chrome and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chromium that Puppeteer
# installs, work.
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
      openjdk-17-jre-headless \
      ca-certificates \
      chromium \
      chromium-driver \
      chromium-shell \
    && apt-get autoremove --assume-yes \
    && apt-get clean --assume-yes \
    && rm -rf /var/lib/apt/list/*


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


# Install sfdx plugins
RUN echo 'y' | sf plugins:install sfdx-browserforce-plugin@2.9.1
RUN echo 'y' | sf plugins:install sfdmu@4.18.2

# install sfpowerscripts
RUN npm install --global @dxatscale/sfpowerscripts@$SFPOWERSCRIPTS_VERSION


ENV SF_CONTAINER_MODE=true
ENV SF_DISABLE_AUTOUPDATE=true
ENV SF_DISABLE_TELEMETRY=true
ENV SF_USE_GENERIC_UNIX_KEYCHAIN=true
ENV SF_USE_PROGRESS_BAR=false


#Add Labels
LABEL org.opencontainers.image.description "sfpowerscripts is a build system for modular development in Salesforce, that can be implemented in any CI/CD system of choice"
LABEL org.opencontainers.image.licenses "MIT"
LABEL org.opencontainers.image.url "https://github.com/dxatscale/sfpowerscripts"
LABEL org.opencontainers.image.documentation "https://docs.dxatscale.io/projects/sfpowerscripts"
LABEL org.opencontainers.image.revision $GIT_COMMIT
LABEL org.opencontainers.image.vendor "DX@Scale"
LABEL org.opencontainers.image.source "https://github.com/dxatscale/sfpowerscripts"
LABEL org.opencontainers.image.title "DX@Scale sfpowercripts docker image - August 23"