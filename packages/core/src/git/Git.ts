import simplegit, { SimpleGit } from "simple-git";

export default class Git {
  private _git: SimpleGit;

  constructor(projectDir?: string) {
    if (projectDir)
      this._git = simplegit(projectDir);
    else
      this._git = simplegit();
  }

  async show(options: string[]): Promise<string> {
    return this._git.show(options);
  }

  async tag(options: string[]): Promise<string[]> {
    let tagResult = await this._git.tag(options);

    let temp: string[] = tagResult.split("\n");
    temp.pop();

    return temp;
  }

  async diff(options: string[]): Promise<string[]> {
    let diffResult = await this._git.diff(options);

    let temp: string[] = diffResult.split("\n");
    temp.pop();

    return temp;
  }

  async log(options: string[]): Promise<string[]> {
    let gitLogResult = await this._git.log(options);

    return gitLogResult["all"][0]["hash"].split("\n");
  }
}
