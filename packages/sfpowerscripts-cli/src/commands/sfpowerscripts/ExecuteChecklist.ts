import { flags, SfdxCommand, FlagsConfig } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import { Messages, SfdxError } from "@salesforce/core";
import * as inquirer from "inquirer";
const yaml = require("js-yaml");
const path = require("path");
const fs = require("fs");
const chalk = require("chalk");
const validate = require('jsonschema').validate;

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
    "@dxatscale/sfpowerscripts",
    "execute_checklist"
);

export default class ExecuteChecklist extends SfdxCommand {
    public static description = messages.getMessage("commandDescription");

    public static examples = [`$ sfdx sfpowerkit:runbook:execute `];

    protected static flagsConfig: FlagsConfig = {
        filepath: flags.filepath({
            char: "f",
            description: messages.getMessage("filePathFlagDescription"),
            required: true
        }),
        report: flags.filepath({
            char: "o",
            description: messages.getMessage("reportFlagDescription"),
            required: true
        }),
        alias: flags.string({
            description: messages.getMessage("envFlagDescription"),
            required: true,
            parse: (input) => input.toLowerCase()
        })
    };

    public async run(): Promise<void> {
        try {
            const filepath: string = this.flags.filepath;
            let report: string = this.flags.report;
            const alias: string = this.flags.alias;

            const checklist: checklist = yaml.safeLoad(fs.readFileSync(filepath, "utf8"));
            // validate(4, checlist);

            console.log(checklist);
            console.log(`\n\n\n`);

            let result = {
                runbook: checklist["runbook"],
                version: checklist["version"],
                metadata: checklist["metadata"],
                schema_version: checklist["schema_version"],
                inputs: {
                    checklist_filepath: filepath,
                    alias: alias
                },
                tasks: []
            };

            for (let task of checklist["tasks"]) {
                if (task.runOnlyOn.toLowerCase() == alias) {
                    this.printTaskInfo(task, checklist["tasks"].length);

                    let start_timestamp: number = Date.now();
                    let responses: any = await inquirer.prompt([
                        {
                        name: "status",
                        type: "list",
                        message: "Task outcome:",
                        choices: ["Completed", "Skipped"]
                        },
                    ]);

                    let end_timestamp: number = Date.now();
                    let duration_ms = (end_timestamp - start_timestamp);

                    this.printDurationMinSec(duration_ms);

                    task["status"] = responses["status"];

                    result["tasks"].push(task);
                }
            }

            console.log(result);

            fs.writeFileSync(report, JSON.stringify(result, null, 2));


        } catch (err) {
            console.log(err);
            process.exit(1);
        }
  }

  private printTaskInfo(task, nTasks): void {
    console.log(`Progress: Task ` + chalk.bold(`${task.id}`) + ` of ${nTasks}\n`);
    console.log(chalk.blue.bold(`${task.task}`));
    console.log(`${task.steps}`);
  }

  private printDurationMinSec(duration_ms) {
    let duration_sec = duration_ms * Math.pow(10,-3);
    duration_sec = Math.floor(duration_sec);
    let display_minutes = Math.floor(duration_sec / 60);
    let display_seconds = duration_sec % 60;
    console.log(
        `${display_minutes}` +
        chalk.bold(`m`) +
        ` ${display_seconds}` +
        chalk.bold(`s`) +
        ` elapsed\n`
    );
  }
}

interface checklist {
    runbook: string,
    version: Number,
    metadata: string,
    schema_version: Number,
    tasks: {
        task: string,
        id: Number,
        steps: string,
        runOnlyOn: string,
        condition: string
    }[]
}
