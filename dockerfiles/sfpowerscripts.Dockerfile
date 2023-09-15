FROM ubuntu:22.04

ARG PMD_VERSION=6.48.0
ARG SFPOWERSCRIPTS_VERSION=alpha
ARG SF_CLI_VERSION=^2
ARG SALESFORCE_CLI_VERSION=nightly
ARG BROWSERFORCE_VERSION=2.9.1
ARG SFDMU_VERSION=4.18.2
ARG GIT_COMMIT
ARG NODE_MAJOR=20

LABEL org.opencontainers.image.description "sfpowerscripts is a build system for modular development in Salesforce."
LABEL org.opencontainers.image.licenses "MIT"
LABEL org.opencontainers.image.url "https://github.com/dxatscale/sfpowerscripts"
LABEL org.opencontainers.image.documentation "https://docs.dxatscale.io/projects/sfpowerscripts"
LABEL org.opencontainers.image.revision $GIT_COMMIT
LABEL org.opencontainers.image.vendor "DX@Scale"
LABEL org.opencontainers.image.source "https://github.com/dxatscale/sfpowerscripts"
LABEL org.opencontainers.image.title "DX@Scale sfpowercripts docker image - July 23"


ENV DEBIAN_FRONTEND=noninteractive

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
      chromium-bsu \
      chromium-driver \
      gnupg \
    && apt-get autoremove --assume-yes \
    && apt-get clean --assume-yes \
    && rm -rf /var/lib/apt/list/*

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
    @dxatscale/sfpowerscripts@${SFPOWERSCRIPTS_VERSION} \
    && npm cache clean --force

# Install sfdx plugins
RUN echo 'y' | sf plugins:install sfdx-browserforce-plugin@${BROWSERFORCE_VERSION} \
    && echo 'y' | sf plugins:install sfdmu@${SFDMU_VERSION} \
    && yarn cache clean --all \
    && rm -r /root/.cache/sf

# Set some sane behaviour in container
ENV SF_CONTAINER_MODE=true
ENV SF_DISABLE_AUTOUPDATE=true
ENV SF_DISABLE_TELEMETRY=true
ENV SF_USE_GENERIC_UNIX_KEYCHAIN=true
ENV SF_USE_PROGRESS_BAR=false

WORKDIR /root

# clear the entrypoint for azure
ENTRYPOINT []
CMD ["/bin/bash"]
