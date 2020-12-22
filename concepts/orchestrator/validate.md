---
description: Run checks before accepting incoming changes
---

# Validate

## What does validate command do?

## What checks do validate run?

## What is the sequence of activities that happen in validate command?

The following are the list of steps that are orchestrated by the validate command

* Authenticate to the DevHub using the provided JWT Key / Client ID
* Fetch a scratch org from the provided pools in a sequential manner
* Build packages that are changed by comparing the tags in your repo
* For each of the packages
  * Deploy all the built packages as [source packages](https://dxatscale.gitbook.io/sfpowerscripts/v/alpha/concepts/source-packages) / [data package](https://dxatscale.gitbook.io/sfpowerscripts/v/alpha/concepts/data-packages)  \(unlocked packages are installed as source package\)
  * Trigger Apex Tests if there are any apex test in the package
  * Validate test coverage of the package depending on the type of the package \( source packages: each class needs to have 75% or more, unlocked packages: packages as  whole need to have 75% or more\)

## Why do validate need JWT based authentication?

## What if there are no scratch org's left in the pool?

## How does validate know which packages to be validated?

## What is a shapefile and why should I provide one?

## How do I get hold of the shapefile?

## My metadata looks intact, but validate is failing? Why is that and what should be done?







