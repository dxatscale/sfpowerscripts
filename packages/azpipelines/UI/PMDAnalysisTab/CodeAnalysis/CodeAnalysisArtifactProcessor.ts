
export default class CodeAnalysisArtifactProcessor {
  pmdResult: any;

  constructor(pmdResult) {
    this.pmdResult = pmdResult;
  }

  public async processCodeQualityFromArtifact(): Promise<CodeAnalysisResult> {
    let name = "sf-pmd-xml";
    let affectedFileCount = 0;
    let violationCount = 0;
    let criticaldefects = 0;
    let details: CodeAnalyisDetail[] = new Array<CodeAnalyisDetail>();

  
      if (!this.pmdResult.file || this.pmdResult.file.length === 0) {
        return {
          name,
          violationCount,
          affectedFileCount,
          criticaldefects,
          details
        };
      }

      this.pmdResult.file.forEach((file: any) => {
        var i = 0;
        if (file.violation) {
          affectedFileCount++;
          violationCount += file.violation.length;
        }
      });

      for (let i = 0; i < this.pmdResult.file.length; i++) {
        this.pmdResult.file[i].violation.forEach(element => {

          //Crappy stuff.. need better logic here.. strip of path's
          let fileName:string = this.pmdResult.file[i]["$"]["name"].substring(this.pmdResult.file[i]["$"]["name"].indexOf(`/home/vsts/work/1/s`)+19);
          if(fileName.includes('d:\\a\\1\\s`'))
          fileName =  fileName.substring(this.pmdResult.file[i]["$"]["name"].indexOf(`d:\\a\\1\\s`)+8);

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
    

    return {
      name,
      violationCount,
      affectedFileCount,
      criticaldefects,
      details
    };
  }
}
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
