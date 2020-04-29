---
title: Branching Model
category: FAQ
order: 1
---

### **1\. What are the common branching strategies that should be followed?**

We have so far positive experience with using a branching strategy similar to [Gitlab Flow](https://docs.gitlab.com/ee/topics/gitlab_flow.html#production-branch-with-gitlab-flow){: target="_blank"}, and changed a bit to realize the benefits offered by Azure Pipeline's Release Pipeline feature.

Here is a rundown on what we follow

&nbsp;

&nbsp;

&nbsp;

**master**&nbsp;is an integration branch, where reviewed code is merged. Upon merging,a CI trigger is invoked which results in the following

* A package version is created using&nbsp;

&nbsp;