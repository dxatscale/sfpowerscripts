import * as vm from 'azure-devops-node-api';
import * as lim from 'azure-devops-node-api/interfaces/LocationsInterfaces';
import * as ReleaseInterfaces from 'azure-devops-node-api/interfaces/ReleaseInterfaces';
import * as ReleaseApi from 'azure-devops-node-api/ReleaseApi';
import * as tl from 'azure-pipelines-task-lib/task';
import { getPersonalAccessTokenHandler, WebApi } from 'azure-devops-node-api';
import { IRequestOptions } from 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces'

function getEnv(name: string): string {
  const val = tl.getVariable(name) as string;
  if (!val) {
    console.error(name + ' env var not set');
    name.includes('SYSTEM_ACCESSTOKEN')
      ? console.log('Remember to enable in the agent "Allow scripts to access the OAuth token"')
      : console.log('It is not found in the agent variables');
    tl.setResult(tl.TaskResult.Failed, 'env var not set');
    process.exit(1);
  }
  return val;
}

function validateEnv(name: string): boolean {
  return !!tl.getVariable(name);
}

export async function getWebApi(): Promise<vm.WebApi> {
  const serverUrl = getEnv('SYSTEM_TEAMFOUNDATIONCOLLECTIONURI');
  return await getApi(serverUrl);
}

export async function getWebAPIWithoutToken():Promise<vm.WebApi> {
  return new Promise<vm.WebApi>(async (resolve, reject) => {
    try {
        const serverUrl: string = tl.getVariable('System.TeamFoundationCollectionUri');
        const serverCreds: string = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);
        const authHandler = getPersonalAccessTokenHandler(serverCreds);

        const maxRetries =  5; // Default to 5 if not specified
     
        const proxy = tl.getHttpProxyConfiguration();
        let options: IRequestOptions = {
            allowRetries: true,
            maxRetries
        };

        if (proxy) {
            options = { ...options, proxy, ignoreSslError: true };
        };

        let serverConnection:vm.WebApi = new vm.WebApi(serverUrl, authHandler, options);
        const connData: lim.ConnectionData = await serverConnection.connect();
        resolve(serverConnection);
      } catch (err) {
        reject(err);
      }
    });

}

export async function getApi(serverUrl: string, optionApi?: any): Promise<vm.WebApi> {
  return new Promise<vm.WebApi>(async (resolve, reject) => {
    try {
      const token = validateEnv('SYSTEM_ACCESSTOKEN_LOCAL')
        ? getEnv('SYSTEM_ACCESSTOKEN_LOCAL')
        : getEnv('SYSTEM_ACCESSTOKEN');
      const authHandler = validateEnv('SYSTEM_ACCESSTOKEN_LOCAL')
        ? vm.getPersonalAccessTokenHandler(token)
        : vm.getBearerHandler(token);
      const option = optionApi;

      const vsts: vm.WebApi = new vm.WebApi(serverUrl, authHandler, option);
      const connData: lim.ConnectionData = await vsts.connect();
      resolve(vsts);
    } catch (err) {
      reject(err);
    }
  });
}

export function getProject(): string {
  return getEnv('SYSTEM_TEAMPROJECTID');
}

export function banner(title: string): void {
  console.log();
  console.log('=======================================');
  console.log('\t' + title);
  console.log('=======================================');
  console.log();
}

export function heading(title: string): void {
  console.log();
  console.log('> ' + title);
}


export async function setReleaseVariable(releaseId: number, variableName: string, variableValue: string, allowOverride: boolean = true, isSecret: boolean = false): Promise<ReleaseInterfaces.Release> {

  return new Promise<ReleaseInterfaces.Release>(async (resolve, reject) => {

    try {

      const webApi: vm.WebApi = await getWebApi();
      const releaseApi: ReleaseApi.IReleaseApi = await webApi.getReleaseApi();
      const project: string = getProject();

      tl.setVariable(variableName, variableValue);

      const release: ReleaseInterfaces.Release = await releaseApi.getRelease(project, releaseId);

      const variableConfiguration: ReleaseInterfaces.ConfigurationVariableValue = {
        allowOverride,
        isSecret,
        value: variableValue
      }

      if (release.variables) {
        release.variables[variableName] = variableConfiguration;
        const newRelease: ReleaseInterfaces.Release = await releaseApi.updateRelease(release, project, Number(releaseId));
        resolve(newRelease);
      } else {
        reject(new Error('Variables is undefined'));
      }
    } catch (error) {
      reject(error);
    }
  });

}