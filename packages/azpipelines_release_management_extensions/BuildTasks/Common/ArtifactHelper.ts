import * as tl from 'azure-pipelines-task-lib/task';
import { isNullOrUndefined } from 'util';

export default class ArtifactHelper
{

    public static getArtifactDirectory(artifactDir:string):string
    {
        if(isNullOrUndefined(artifactDir))
        {
        const taskType: string = tl.getVariable("Release.ReleaseId") ? "Release" : "Build";
        if(taskType=='Release')
          return tl.getVariable("system.artifactsDirectory");
        else
           return tl.getVariable("pipeline.workspace");
        }
        else
         return artifactDir;
    }

    public static skipTaskWhenArtifactIsMissing(isToBeSkipped:boolean)
    {
      if(isToBeSkipped)
      {
      console.log(
        `Skipping task as artifact is missing, and 'Skip If no artifact is found is true'`
      );
      tl.setResult(
        tl.TaskResult.Skipped,
        `Skipping task as artifact is missing, and 'Skip If no artifact is found is true'`
      );
      process.exit(0);
      }
    }
}