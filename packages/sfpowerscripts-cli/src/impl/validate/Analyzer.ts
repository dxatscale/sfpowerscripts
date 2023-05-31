import ChangedComponentsFetcher from "@dxatscale/sfpowerscripts.core/lib/dependency/ChangedComponentsFetcher";
import Component from "@dxatscale/sfpowerscripts.core/lib/dependency/Component";


export class Analyzer {



  private static changedComponents: Component[];

  public constructor(protected baseBranch: string) { }


  /**
   *
   * @returns array of components that have changed, can be empty
   */
  protected async getChangedComponents(): Promise<Component[]> {
    if (Analyzer.changedComponents) return Analyzer.changedComponents;
    else return new ChangedComponentsFetcher(this.baseBranch).fetch();
  }
}