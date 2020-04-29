import xml2js = require("xml2js");

export interface CodeAnalyisDetail {
  filename: string;
  beginLine: number;
  priority: number;
  problem: string;
}
export interface CodeAnalysisResult {
  name: string;
  violationCount: number;
  affectedFileCount: number;
  criticaldefects: number;
  details: CodeAnalyisDetail[];
}

export default class CodeAnalysisArtifactProcessor {
  reportContents: string;

  constructor(reportContents) {
    this.reportContents = reportContents;
  }

  public async processCodeQualityFromArtifact(): Promise<CodeAnalysisResult> {
    let name = "sf-pmd-xml";
    let affectedFileCount = 0;
    let violationCount = 0;
    let criticaldefects = 0;
    let details: CodeAnalyisDetail[] = new Array<CodeAnalyisDetail>();

    xml2js.parseString(this.reportContents, (err, data) => {
      // If the file is not XML, or is not from PMD, return immediately
      if (!data || !data.pmd) {
        console.debug(`Empty or unrecognized PMD xml report`);
        return undefined;
      }

      if (!data.pmd.file || data.pmd.file.length === 0) {
        // No files with violations, return now that it has been marked for upload
        return undefined;
      }

      data.pmd.file.forEach((file: any) => {
        var i = 0;
        if (file.violation) {
          affectedFileCount++;
          violationCount += file.violation.length;
        }
      });

      for (let i = 0; i < data.pmd.file.length; i++) {
        data.pmd.file[i].violation.forEach(element => {

          //Crappy stuff.. need better logic here.. strip of path's
          let fileName:string = data.pmd.file[i]["$"]["name"].substring(data.pmd.file[i]["$"]["name"].indexOf(`/home/vsts/work/1/s`)+19);
          if(fileName.includes('d:\\a\\1\\s`'))
          fileName =  fileName.substring(data.pmd.file[i]["$"]["name"].indexOf(`d:\\a\\1\\s`)+8);

          let detail: CodeAnalyisDetail = { 
           filename: fileName,
            beginLine: element["$"]["beginline"],
            priority: element["$"]["priority"],
            problem: element["_"]
          };

          details.push(detail);

          if (element["$"]["priority"] == 1) {
            criticaldefects++;
          }
        });
      }
    });

    return {
      name,
      violationCount,
      affectedFileCount,
      criticaldefects,
      details
    };
  }
}
