---
description: Using docker images in your CI/CD
---

# Docker

Put simply, the sfpowerscripts Docker image will allow you to run your builds / releases within a container, which is like a virtualised environment running on a physical system and has its own OS, apps etc. For more information on Docker and containerisation, visit [Docker's documentation](https://docs.docker.com/).

The sfpowerscripts Docker image is available at:

* \*\*\*\*[**Docker Hub**](https://hub.docker.com/r/dxatscale/sfpowerscripts)\*\*\*\*

We recommend using the sfpowerscripts Docker image because it will grant your CICD pipelines **greater reliability** - avoiding breakages due to updates in sfpowerscripts or its dependencies \(e.g. SFDX CLI, SFDMU\). Each sfpowerscripts image has static versions of sfpowerscripts and its dependencies, which means that it will not be affected by any updates.  

Utilizing the sfpowerscripts Docker image will give you the surety that your **builds are consistently running in the same environment** - meaning that you can safely assume that discrepancies between builds are not a result of environment setup.      

Most of all, the sfpowerscripts Docker image makes things easy. We have already done all the hard work of creating an image that has all the required dependencies installed \(Node, JDK, sfpowerkit, sfdmu, etc.\). All that is required from you is to pull the image from the registry and run it.

