FROM ubuntu:18.04

# Install Node.js v14.x
RUN apt-get update -qq && \
    DEBIAN_FRONTEND=noninteractive apt-get install -qq \
        curl \
        sudo \
        git \
        jq \
        zip \
        unzip

RUN curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash - \
    && sudo apt-get install -qq nodejs


# Install OpenJDK-8
RUN apt-get update -qq && \
    apt-get install -qq openjdk-8-jdk && \
    apt-get clean -qq && \
	rm -rf /var/cache/oracle-jdk8-installer && \
    rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME /usr/lib/jvm/java-8-openjdk-amd64/
RUN export JAVA_HOME


# Install SFDX CLI
RUN npm update -g && \
    npm install sfdx-cli --global

# Install sfdx plugins
RUN echo 'y' | sfdx plugins:install sfpowerkit && \
    echo 'y' | sfdx plugins:install @dxatscale/sfpowerscripts && \
    echo 'y' | sfdx plugins:install sfdmu
