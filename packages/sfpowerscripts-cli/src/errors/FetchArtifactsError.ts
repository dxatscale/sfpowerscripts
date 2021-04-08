import SfpowerscriptsError from "./SfpowerscriptsError";

export default class FetchArtifactsError extends SfpowerscriptsError {

  data: {
    success: [string, string][],
    failed: [string, string][]
  }

  constructor(
    message: string,
    data: {success: [string, string][], failed: [string,string][]}
  ) {
    super(message);

    this.data = data;
  }

}
