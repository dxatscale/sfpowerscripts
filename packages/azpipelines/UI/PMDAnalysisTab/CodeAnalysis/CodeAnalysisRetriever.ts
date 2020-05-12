import { BuildRestClient } from "azure-devops-extension-api/Build";
import * as SDK from "azure-devops-extension-sdk";

export default class CodeAnalysisRetriever {
  client: BuildRestClient;
  projectId: string;
  buildId: number;

 

  constructor(client: BuildRestClient, projectId: string, buildId: number) {
    this.client = client;
    this.projectId = projectId;
    this.buildId = buildId;
  }

  public async downloadCodeAnalysisArtifact(): Promise<string[]> {
    let analysisArtifacts: string[] = [];

    const codeAnalysisAttachement = await this.client.getAttachments(
      this.projectId,
      this.buildId,
      "pmd_analysis_results"
    );

    let accessToken = await SDK.getAccessToken();

    for (let i = 0; i < codeAnalysisAttachement.length; i++) {

  
      var headers = new Headers();
      headers.append(
        "Authorization",
        `Bearer ${accessToken}`
      );
      let requestOption:RequestInit = {
        method: "GET",
        headers: headers,
        redirect: "follow"
      };
      let request = new Request(codeAnalysisAttachement[i]._links['self']['href'],requestOption);
      let response: Response = await fetch(request);
      let result = await response.text();

    
      analysisArtifacts.push(result);
    }
    return analysisArtifacts;
  }
}
