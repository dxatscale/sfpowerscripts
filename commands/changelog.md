---
description: Gather the release notes!
---

# Changelog

{% hint style="info" %}
Did you know the changelog can now be generated as part of the `orchestrator:release` command? Switch over to begin tracking your orgs and which release they are currently on.
{% endhint %}

The `changelog:generate` command gives you a running history of artifacts, work items and commits that were introduced in a deployment. Simply attach the command to your deployment pipeline, and it will generate the changelog in mardown format `Release-Changelog.md` , on the branch `sfp_changelog_<artifact_source_branch>`, which you could display in a wiki.

```text
OPTIONS
  -d, --artifactdir=artifactdir                                                     (required) [default: artifacts] Directory containing sfpowerscripts artifacts
  -n, --releasename=releasename                                                     (required) Name of the release for which to generate changelog

  -r, --repourl=repourl                                                             (required) Repository in which the changelog files are located. Assumes user is already 
                                                                                    authenticated.

  -w, --workitemfilter=workitemfilter                                               (required) Regular expression used to search for work items (user stories) introduced in 
                                                                                    release

  --json                                                                            format output as json

  --limit=limit                                                                     limit the number of releases to display in changelog markdown

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for this command invocation

  --showallartifacts                                                                Show all artifacts in changelog markdown, including those that have not changed in the 
                                                                                    release

  --workitemurl=workitemurl
```

The data for each release is stored in JSON format `releasechangelog.json` and saved to a source repository specified by the user. Each new release is formed by comparing data from the previous release to determine the new commits and work items.

## Work items

Work items are identified by searching for the pattern, defined by the `--workitemfilter` flag, within commit messages. This implies that in order to take full advantage of the changelog functionality, you need to label your commit messages with the corresponding work item. The `--workitemfilter` flag accepts regular expressions and is case-insensitive.

```text
# One possible regular expression that would match  the commit message below 
# --workitemfilter "BRO-[0-9]{3,4}"

$ git commit -m "Implement user story BRO-3035"
```

