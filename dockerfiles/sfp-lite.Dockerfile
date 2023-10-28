FROM ubuntu:22.04


ARG SFPOWERSCRIPTS_VERSION=alpha
ARG GIT_COMMIT
ARG NODE_MAJOR=18

LABEL org.opencontainers.image.description "sfpowerscripts is a build system for modular development in Salesforce."
LABEL org.opencontainers.image.licenses "MIT"
LABEL org.opencontainers.image.url "https://github.com/dxatscale/sfpowerscripts"
LABEL org.opencontainers.image.documentation "https://docs.dxatscale.io/sfpowerscripts/sfpowerscripts"
LABEL org.opencontainers.image.revision $GIT_COMMIT
LABEL org.opencontainers.image.vendor "DX@Scale"
LABEL org.opencontainers.image.source "https://github.com/dxatscale/sfpowerscripts"
LABEL org.opencontainers.image.title "DX@Scale sfp lite docker image - December 23"


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


# Install sfpowerscripts
RUN npm install --global --omit=dev \
    @dxatscale/sfpowerscripts@${SFPOWERSCRIPTS_VERSION} 

WORKDIR /root



# clear the entrypoint for azure
ENTRYPOINT []
CMD ["/bin/sh"]
