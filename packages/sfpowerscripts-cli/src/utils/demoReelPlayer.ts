import path = require("path");
import * as fs from "fs-extra";
var marked = require("marked");
var TerminalRenderer = require("marked-terminal");
import { delay } from "@dxatscale/sfpowerscripts.core/lib/utils/Delay";

export default class DemoReelPlayer {
  public async execute(demoReelFolderPath: string) {

    //Define renderer
    marked.setOptions({
      // Define custom renderer
      renderer: new TerminalRenderer(),
    });

    let demoReel: demoReel = fs.readJSONSync(path.join(demoReelFolderPath,"demo.json"), {
      encoding: "UTF-8",
    });
    for (let response of demoReel.sequence) {
      let ext = path.extname(path.resolve(demoReelFolderPath,response.filepath));
      let data = fs.readFileSync(path.resolve(demoReelFolderPath,response.filepath), "utf8");

      if (response.data) {
        Object.entries(response.data).forEach((entry) => {
          data = data.replace(`\$\{\{${entry[0]}\}\}`, entry[1]);
        });
      }

      if (response.repeat) {
        let count = 0;
        while (count <= response.repeat) {
          await delay(response.preDelay);
          if (ext === ".md") {
            console.log(marked(data));
          } else {
            console.log(data);
          }
          count++;
          await delay(response.postDelay);
        }
      } else {
        await delay(response.preDelay);
        if (ext === ".md") {
          console.log(marked(data));
        } else {
          console.log(data);
        }
        await delay(response.postDelay);
      }
    }
  }
}

interface demoReel {
  sequence: {
    filepath: string;
    preDelay: number;
    postDelay: number;
    repeat: number;
    data: { [p: string]: string };
  }[];
}
