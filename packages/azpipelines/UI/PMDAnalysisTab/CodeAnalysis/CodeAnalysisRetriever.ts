import { ExtensionManagementRestClient } from "azure-devops-extension-api/ExtensionManagement";

const PUBLISHER_NAME="AzlamSalam"
const SCOPE_TYPE = "Default";
const SCOPE_VALUE = "Current";

export default class CodeAnalysisRetriever {
  client: ExtensionManagementRestClient;
  projectId: string;
  buildId: string;
  extensionName:string;
 

 

  constructor(extensionName:string,client:ExtensionManagementRestClient , projectId: string, buildId: string) {
    this.client = client;
    this.projectId = projectId;
    this.buildId = buildId;
    this.extensionName=extensionName;
    
  }

  public async downloadCodeAnalysisArtifact(): Promise<any> {

    let doc = await this.client.getDocumentByName(PUBLISHER_NAME,this.extensionName,SCOPE_TYPE,SCOPE_VALUE,"sfpowerscripts_pmd",this.buildId);
    return doc.pmd_result.pmd;

  }

}
