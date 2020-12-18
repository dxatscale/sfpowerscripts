---
description: All about collecting metrics from sfpowerscripts
---

# Metrics and Dashboards

## How is metrics reported from sfpowerscripts?

Metrics should be a key part of your DevOps process. It is through these metrics, one can drive continuous improvement of your delivery process. Almost all commands in sfpowerscripts, are instrumented with StatsD. Read more about StatsD here \([https://www.datadoghq.com/blog/statsd/](https://www.datadoghq.com/blog/statsd/)\)

## How do I start capturing metrics?

Couple of things

*  Ensure you have a StatsD Daemon running on a server, Setting up StatsD daemon on a server is quite simple, there are lot of guides available \([https://www.scalyr.com/blog/statsd-measure-anything-in-your-system/](https://www.scalyr.com/blog/statsd-measure-anything-in-your-system/)\) . If you are after a hosted StatsD, hosted Graphite offers a hosted StatsD solution as part of their Hosted Graphite offering \([https://www.hostedgraphite.com/docs/integrationguide/ig\_hosted\_statsd.html](https://www.hostedgraphite.com/docs/integrationguide/ig_hosted_statsd.html)\). 
* Ensure your build agents can reach the StatsD server, this can be bit problematic, when you are using cloud based agents, which imply StatsD service has to be on the internet and reachable from the agent, so plan this out.  If you are using self hosted agents, the StatsD server should be reachable as well.
* To visualize these metrics, you need a StatsD Backend \([https://thenewstack.io/collecting-metrics-using-statsd-a-standard-for-real-time-monitoring/](https://thenewstack.io/collecting-metrics-using-statsd-a-standard-for-real-time-monitoring/)\) such as DataDog \(Hosted\), Graphana, and many others to aggergate and report data.
* Enable StatsD metrics in your scripts by adding these environment variables

```text
 # Set STATSD Environment Variables for logging metrics about this build
 export SFPOWERSCRIPTS_STATSD=true
 export SFPOWERSCRIPTS_STATSD_HOST=172.23.95.52 
 export SFPOWERSCRIPTS_STATSD_PORT=8125     // Optional, defaults to 8125 
 export SFPOWERSCRIPTS_STATSD_PROTOCOL=UDP  // Optional, defualts to UDP, Supports UDP/TCP
```

## What are the metrics being captured?

The following are the list of metrics that are captured.

| METRIC  | DESCRIPTION | TYPE |
| :--- | :--- | :--- |
| sfpowerscripts.deploy.failed  | Number of times deploy command failed | COUNT |
|  sfpowerscripts.deploy.duration | Time spent on executing deploy command | GUAGE |
| sfpowerscripts.deploy.scheduled  | Number of times deployment was scheduled to run | COUNT |
| sfpowerscripts.deploy.succeeded | Number of succeeded deploy executions | COUNT |
| sfpowerscripts.build.scheduled | Number of times build was scheduled to run | COUNT |
| sfpowerscripts.build.duration  | Time spent on executing build command | GUAGE |
| sfpowerscripts.build.scheduled.packages | Number of packages being scheduled to build | GUAGE |
| sfpowerscripts.build.succeeded.packages | Number of packages successfully built  | GUAGE |
| sfpowerscripts.build.failed.packages  | Number of packages failed to build | GUAGE |
| sfpowerscripts.validate.failed  | Number of time validate failed to execute | COUNT |
| sfpowerscripts.validate.duration  | Time spent on executing validate command | GUAGE |
| sfpowerscripts.publish.duration  | Time spent on executing publish command | GUAGE |
| sfpowerscripts.publish.succeeded | Number of succeeded publish executions | COUNT |
| sfpowerscripts.package.installation  | Number of times a package was installed | COUNT |
| sfpowerscripts.package.installation.elapsed\_time | Time taken to install a package | GUAGE |
| sfpowerscripts.package.elapsed | Time taken to create a package | GUAGE |
| sfpowerscripts.package.created | Number of times a particular package was created | COUNT |
| sfpowerscripts.package.metadatacount  | Number of metadata in a package | GUAGE |
| sfpowerscripts.package.testcoverage | Test Coverage of a package | GUAGE |
| sfpowerscripts.apextests.triggered  | Number of times apex tests were triggered for a package | COUNT |
| sfpowerscripts.apextest.testtotal | Time taken for Apex Test Execution  | GUAGE |
| sfpowerscripts.apextest.command.time | Time taken for Apex Test  Execution \(Command Time\) | GUAGE |

## Can you show me examples of dashboards that could be created with these metrics?

![Package Status Dashboard](../.gitbook/assets/status_package.jpeg)

![Package Weekly Status](../.gitbook/assets/image%20%288%29.png)



