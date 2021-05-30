import FetchAnArtifact from "./FetchAnArtifact";
import { FetchAnArtifactFromNPM } from "./FetchAnArtifactFromNPM";
import { FetchAnArtifactUsingScript } from "./FetchAnArtifactUsingScript";

export default class FetchArtifactSelector {
  constructor(
    private fetchArtifactScript: string,
    private scope: string,
    private npmTag: string,
    private npmrcPath: string
  ) {}

  public getArtifactFetcher(): FetchAnArtifact {
    if (this.fetchArtifactScript) {
      return new FetchAnArtifactUsingScript(this.fetchArtifactScript);
    } else {
      return new FetchAnArtifactFromNPM(
        this.scope,
        this.npmTag,
        this.npmrcPath
      );
    }
  }
}
