FROM node:18-bookworm

ARG SFPOWERSCRIPTS_VERSION=alpha
ARG SF_CLI_VERSION=^2
ARG BROWSERFORCE_VERSION=2.9.1
ARG SFDMU_VERSION=4.18.2
ARG GIT_COMMIT

LABEL org.opencontainers.image.description "sfpowerscripts is a build system for modular development in Salesforce, its delivered as a sfdx plugin that can be implemented in any CI/CD system of choice"
LABEL org.opencontainers.image.licenses "MIT"
LABEL org.opencontainers.image.url "https://github.com/dxatscale/sfpowerscripts"
LABEL org.opencontainers.image.documentation "https://docs.dxatscale.io/projects/sfpowerscripts"
LABEL org.opencontainers.image.revision $GIT_COMMIT
LABEL org.opencontainers.image.vendor "DX@Scale"
LABEL org.opencontainers.image.source "https://github.com/dxatscale/sfpowerscripts"
LABEL org.opencontainers.image.title "DX@Scale sfpowercripts docker image - July 23"


ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get -y install --assume-yes --no-install-recommends \
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

# Install SF cli
RUN npm install --global --omit=dev @salesforce/cli@${SF_CLI_VERSION}

# Install sfdx plugins
RUN echo 'y' | sf plugins:install sfdx-browserforce-plugin@${BROWSERFORCE_VERSION}
RUN echo 'y' | sf plugins:install sfdmu@${SFDMU_VERSION}

# Install sfpowerscripts
RUN npm install --global --omit=dev @dxatscale/sfpowerscripts@${SFPOWERSCRIPTS_VERSION}

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
