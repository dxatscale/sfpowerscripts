import { expect } from "@jest/globals";
import OrgsUpdater from "../../../src/impl/changelog/OrgsUpdater"
import { ReleaseChangelog, Release, ReleaseId } from "../../../src/impl/changelog/ReleaseChangelogInterfaces";
import lodash = require("lodash");

describe("Given an OrgsUpdater", () => {
  // new release, org & no org
  // old release, org-not current release (add/update org.releases), org-current release, & no org

  let releaseChangelog: ReleaseChangelog;
  let expectedResult: ReleaseChangelog;

  beforeEach( () => {
    releaseChangelog = lodash.cloneDeep(referenceReleaseChangelog);
    expectedResult = lodash.cloneDeep(referenceReleaseChangelog);
  });

  it("should add new org, for a new release", () => {
    new OrgsUpdater(
      releaseChangelog,
      newRelease,
      "DEV",
      null
    ).update()

    let newReleaseId = convertReleaseToId(newRelease);
    expectedResult.orgs.push({name: "DEV", releases: [newReleaseId], latestRelease: newReleaseId, retryCount: 0});
    expect(releaseChangelog).toEqual(expectedResult);
  });

  it("should update an org, for a new release", () => {
    let releaseIds: ReleaseId[] = [];
    releaseChangelog.releases.forEach((release) => {
      releaseIds.push(convertReleaseToId(release));
    });

    let org = {
      name: "DEV",
      releases: releaseIds,
      latestRelease: releaseIds[releaseIds.length - 1],
      retryCount: 0
    };

    releaseChangelog.orgs.push(org);
    expectedResult.orgs.push(lodash.cloneDeep(org));

    new OrgsUpdater(
      releaseChangelog,
      newRelease,
      "DEV",
      null
    ).update();

    let newReleaseId = convertReleaseToId(newRelease);
    expectedResult.orgs[0].releases.push(newReleaseId);
    expectedResult.orgs[0].latestRelease = newReleaseId;
    expect(releaseChangelog).toEqual(expectedResult);
  });

  it("should update an org with the release, for an old release", () => {
    let releaseIds: ReleaseId[] = [];
    releaseChangelog.releases.forEach((release) => {
      releaseIds.push(convertReleaseToId(release));
    });

    let org_dev = {
      name: "DEV",
      releases: releaseIds,
      latestRelease: releaseIds[releaseIds.length - 1],
      retryCount: 0
    };

    let org_sit = {
      name: "SIT",
      releases: [releaseIds[0]],
      latestRelease: releaseIds[0],
      retryCount: 0
    };

    releaseChangelog.orgs.push(org_dev);
    releaseChangelog.orgs.push(org_sit);

    expectedResult.orgs.push(lodash.cloneDeep(org_dev));

    let expectedReleaseIds = lodash.cloneDeep(releaseIds);

    expectedResult.orgs.push({
      name: "SIT",
      releases: expectedReleaseIds,
      latestRelease: expectedReleaseIds[1],
      retryCount: 0
    });

    new OrgsUpdater(
      releaseChangelog,
      oldRelease1,
      "SIT",
      releaseChangelog.releases[1]
    ).update();

    expect(releaseChangelog).toEqual(expectedResult);
  });

  it("should update an org's retryCount, for an old release", () => {
    let releaseId = convertReleaseToId(releaseChangelog.releases[0]);

    let org = {
      name: "DEV",
      releases: [releaseId],
      latestRelease: releaseId,
      retryCount: 0
    };

    releaseChangelog.orgs.push(org);

    expectedResult.orgs.push(lodash.cloneDeep(org));
    expectedResult.orgs[0].retryCount++

    new OrgsUpdater(
      releaseChangelog,
      oldRelease2,
      "DEV",
      releaseChangelog.releases[0]
    ).update();

    expect(releaseChangelog).toEqual(expectedResult);
  });
});




const oldRelease1: Release = {
  names: ["release-1"],
  buildNumber: 3,
  workItems: {},
  artifacts: [
    {
      "name": "ESBaseCodeLWC",
      "from": undefined,
      "to": "3d45227b",
      "version": "50.0.5.6",
      "latestCommitId": undefined,
      "commits": []
    }
  ],
  "hashId": "c97e09b76f82d830731359abe1bab2c9c5be13a9"
}

const oldRelease2: Release = {
  names: ["release-1"],
  buildNumber: 2,
  workItems: {},
  artifacts: [
    {
      "name": "ESBaseCodeLWC",
      "from": undefined,
      "to": "2dbd257a",
      "version": "50.0.5.5",
      "latestCommitId": undefined,
      "commits": []
    }
  ],
  "hashId": "975c78d55ef4dce9621dfb61b6349d463e7003d0"
}

const newRelease: Release = {
  names: ["release-1"],
  buildNumber: 3,
  workItems: {},
  artifacts: [
    {
      "name": "ESBaseCodeLWC",
      "from": undefined,
      "to": "27b545ef",
      "version": "50.0.5.7",
      "latestCommitId": undefined,
      "commits": []
    }
  ],
  hashId: "fd0edacd5a6ee547aac0068b22f839201fbc3c7f"
}

const referenceReleaseChangelog: ReleaseChangelog = {
  "orgs": [],
  "releases": [
    {
      "names": ["release-1"],
      "buildNumber": 1,
      "workItems": {},
      "artifacts": [
        {
          "name": "ESBaseCodeLWC",
          "from": "1cbf12aa",
          "to": "2dbd257a",
          "version": "50.0.5.5",
          "latestCommitId": "d7124579",
          "commits": [
            {
              "commitId": "d7124579",
              "date": "2020-10-19T02:30:31-04:00",
              "author": "Mohith Shrivastava",
              "message": "feat: winter '21 release updates (#178)",
              "body": "* Upgrade sa11y version (#165)\r\n\r\n* Update to v50.0 api version (#164)\r\n\r\n* update api version and sfdx-jest versions\r\n\r\n* update sfdx-project.json version\r\n\r\n* updated package json\r\n\r\n* freeze api version for jests to pass\r\n\r\n* update package lock file\r\n\r\n* fix prettier issue\r\n\r\n* fix failing test\r\n\r\n* update v50.0\r\n\r\n* feat: flow refactor with innvocable method (#168)\r\n\r\n* update api version and sfdx-jest versions\r\n\r\n* update sfdx-project.json version\r\n\r\n* updated package json\r\n\r\n* freeze api version for jests to pass\r\n\r\n* update package lock file\r\n\r\n* fix prettier issue\r\n\r\n* fix failing test\r\n\r\n* fix class names\r\n\r\n* Delete lower case class names\r\n\r\n* Delete lower case class names\r\n\r\nDelete lower case class names\r\n\r\n* Delete lower case class names\r\n\r\nDelete lower case class names\r\n\r\n* Delete lower case class names\r\n\r\nDelete lower case class names\r\n\r\n* Delete lower case class names\r\n\r\n* Delete marketServices.cls-meta.xml\r\n\r\nDelete lower case class names\r\n\r\n* Delete lower case class names\r\n\r\n* Delete lower case class names\r\n\r\n* Delete lower case class names\r\n\r\n* Delete lower case class names\r\n\r\n* delete lower cases classes\r\n\r\n* delete lower cases classes\r\n\r\n* delete lower cases classes\r\n\r\n* delete lower cases classes\r\n\r\n* fix class name in perms\r\n\r\n* refactor flows to be object agnostic\r\n\r\n* fix package lock json merge\r\n\r\n* address comments\r\n\r\n* fix: refactor the reservation manager method\r\n\r\n* run prettier\r\n\r\n* update the version to 50.0\r\n\r\n* refactor: use winter21 safe nav operators for null checks (#170)\r\n\r\n* feat: refactor flows to use flow screen elements (#169)\r\n\r\n* update api version and sfdx-jest versions\r\n\r\n* update sfdx-project.json version\r\n\r\n* updated package json\r\n\r\n* freeze api version for jests to pass\r\n\r\n* update package lock file\r\n\r\n* fix prettier issue\r\n\r\n* fix failing test\r\n\r\n* fix class names\r\n\r\n* Delete lower case class names\r\n\r\n* Delete lower case class names\r\n\r\nDelete lower case class names\r\n\r\n* Delete lower case class names\r\n\r\nDelete lower case class names\r\n\r\n* Delete lower case class names\r\n\r\nDelete lower case class names\r\n\r\n* Delete lower case class names\r\n\r\n* Delete marketServices.cls-meta.xml\r\n\r\nDelete lower case class names\r\n\r\n* Delete lower case class names\r\n\r\n* Delete lower case class names\r\n\r\n* Delete lower case class names\r\n\r\n* Delete lower case class names\r\n\r\n* delete lower cases classes\r\n\r\n* delete lower cases classes\r\n\r\n* delete lower cases classes\r\n\r\n* delete lower cases classes\r\n\r\n* fix class name in perms\r\n\r\n* refactor flows to be object agnostic\r\n\r\n* fix package lock json merge\r\n\r\n* feat: refactor flows to use flow screen elements\r\n\r\n* add jest tests for draft event\r\n\r\n* fix comments\r\n\r\n* fix: provide access for @auraenabled apex class winter21 (#172)\r\n\r\n* fix: provide access for @auraenabled apex class winter21\r\n\r\n* pretiier formatting\r\n\r\n* fix: small issues for winter 21 updates (#181)\r\n\r\n* Changed package versions to 50.0.0\r\n\r\nCo-authored-by: Alba Rivas <arivas@salesforce.com>\r\nCo-authored-by: Philippe Ozil <5071767+pozil@users.noreply.github.com>"
            }
          ]
        }
      ],
      "hashId": "975c78d55ef4dce9621dfb61b6349d463e7003d0"
    },
    {
      "names": ["release-1"],
      "buildNumber": 2,
      "workItems": {},
      "artifacts": [
        {
          "name": "ESBaseCodeLWC",
          "from": "2dbd257a",
          "to": "3d45227b",
          "version": "50.0.5.6",
          "latestCommitId": "c8dbab13",
          "commits": [
            {
              "commitId": "c8dbab13",
              "date": "2021-01-25T11:01:55+11:00",
              "author": "Azlam",
              "message": "Add persist credential to PR (#6)",
              "body": "* Add persist credential to PR\r\n\r\n* switch to alpha\r\n\r\n* Increment versions\r\n\r\n* Revert \"Increment versions\"\r\n\r\nThis reverts commit 39a68617d8e92de46604b883b6681e8022d2e403.\r\n\r\n* Test abs path\r\n\r\n* Revert \"Test abs path\"\r\n\r\nThis reverts commit 5ab30a8b52eddf16025acf6aec57d1bb9262549d.\r\n\r\n* Cleanup and switch to prod version of sfpowerscripts\r\n\r\nCo-authored-by: sfpowerscripts <sfpowerscripts@dxscale>\r\nCo-authored-by: Alan Ly <alan.ly@accenture.com>"
            }
          ]
        }
      ],
      "hashId": "c97e09b76f82d830731359abe1bab2c9c5be13a9"
    }
  ]
}

function convertReleaseToId(release: Release): ReleaseId {
  let releaseNames = [...release.names]; // Shallow copy
  return {
    names: releaseNames,
    buildNumber: release.buildNumber,
    hashId: release.hashId
  }
}
