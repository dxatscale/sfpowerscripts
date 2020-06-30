import { flags, SfdxCommand, FlagsConfig } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import { Messages, SfdxError } from "@salesforce/core";
import * as inquirer from "inquirer";
import { string } from "@oclif/command/lib/flags";
import { isNullOrUndefined } from "util";
const yaml = require("js-yaml");
const path = require("path");
const fs = require("fs");
const os = require("os");
const chalk = require("chalk");
const Validator = require('jsonschema').Validator;

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
        outputdir: flags.directory({
            char: "o",
            description: messages.getMessage("outputDirFlagDescription"),
            required: true
        }),
        alias: flags.string({
            description: messages.getMessage("envFlagDescription"),
            parse: (input) => input.toLowerCase()
        }),
        executionlog: flags.filepath({
            description: messages.getMessage("executionLogFlagDescription"),
        })
    };

    public async run(): Promise<void> {
        try {
            const filepath: string = this.flags.filepath;
            const executionLog: string = this.flags.executionlog;
            let alias: string = this.flags.alias;

            let outputDir: string = path.join(
                this.flags.outputdir,
                alias
            );

            if (!fs.existsSync(outputDir))
                fs.mkdirSync(outputDir);

            let startDate = new Date();
            let ddmmyyyy = this.getDate(startDate);
            let time = this.getTime(startDate);

            let outputPath = path.join(
                outputDir,
                `execution_log_${ddmmyyyy}-${time}`
            );

            const checklist: checklist = yaml.safeLoad(fs.readFileSync(filepath, "utf8"));
            this.validateChecklist(checklist);

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

            let taskQueue = [];

            if (!isNullOrUndefined(executionLog)) {
                if (fs.existsSync(executionLog)) {
                    let executionLogJson = JSON.parse(fs.readFileSync(executionLog, "utf8"));
                    alias = executionLogJson["inputs"]["alias"];
                    result["tasks"] = result["tasks"].concat(executionLogJson["tasks"]);

                    let latestTaskId = executionLogJson["tasks"][executionLogJson["tasks"].length-1]["id"];
                    taskQueue = checklist["tasks"].slice(latestTaskId); // what if id's are wrong?
                } else throw new Error(`Cannot find file ${executionLog}`);
            } else {
                taskQueue = checklist["tasks"];
            }

            if (taskQueue.length == 0)
                console.log(`No tasks remaining in ${executionLog}`);
            else {
                console.log(`Executing checklist ${checklist["runbook"]} v${checklist["version"]}`);
                let taskNum = 0;
                for (let task of taskQueue) {
                    if (
                        isNullOrUndefined(task.runOnlyOn) ||
                        task.runOnlyOn.toLowerCase() == alias
                    ) {
                        taskNum++;
                        this.printTaskInfo(task, taskNum, taskQueue.length);

                        let start_timestamp: number = Date.now();
                        let responses: any = await inquirer.prompt([
                            {
                            name: "status",
                            type: "list",
                            message: "Task action:",
                            choices: ["Done", "Skip", "Quit"]
                            },
                        ]);
                        // skip reason
                        // print id
                        // reason for skipping over tasks
                        // Executing checklist ${name}
                        if (responses["status"] == "Quit") {
                            break;
                        }

                        let end_timestamp: number = Date.now();
                        let duration_ms = (end_timestamp - start_timestamp);

                        this.printDurationMinSec(duration_ms);

                        task["status"] = responses["status"];
                        task["timeTaken"] = duration_ms;
                        task["User"] = os.hostname();
                        task["Date"] = new Date();

                        result["tasks"].push(task);

                        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
                    }
                }

                console.log(result);


            }

        } catch (err) {
            console.log(err);
            process.exit(1);
        }
  }

  private printTaskInfo(task, taskNum, nTasks): void {
    console.log(`Progress: Task ` + chalk.bold(`${taskNum}`) + ` of ${nTasks}\n`);
    console.log(`Id: ${task.id}`);
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

  private getDate(date: Date): string {
    let day = date.getDate();
    let month = date.getMonth();
    let year = date.getFullYear();
    let pad = (n) => n<10 ? '0'+n : n;

    return pad(day) + "-" + pad(month+1) + "-" + year;
  }

  private getTime(date: Date): string {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    let seconds = date.getSeconds();
    let pad = (n) => n<10 ? '0'+n : n;

    return pad(hours) + ":" + pad(minutes) + ":" + pad(seconds);
  }

  private validateChecklist(checklist: checklist): void {
    let v = new Validator();

    const taskSchema = {
        "id": "/task",
        "type": "object",
        "properties": {
            "task": {
                "type": "string"
            },
            "id": {
                "type": "number"
            },
            "steps": {
                "type": "string"
            },
            "runOnlyOn": {
                "type": "string"
            },
            "condition": {
                "type": "string"
            }
        },
        "required": ["task", "id", "steps"]
    };

    const refSchema = {
        "type": "object",
        "properties": {
            "runbook": {
                "type": "string"
            },
            "version": {
                "type": "number"
            },
            "metadata": {
                "type": "string"
            },
            "schema_version": {
                "type": "number"
            },
            "tasks": {
                "type": "array",
                "items": {
                    "$ref": "/task"
                }
            }
        },
        "required": ["runbook", "version", "metadata", "schema_version", "tasks"]
    };

    v.addSchema(taskSchema, '/task');
    let validationResult = v.validate(checklist, refSchema);
    if (validationResult.errors.length > 0) {
        throw validationResult.errors;
    }
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
