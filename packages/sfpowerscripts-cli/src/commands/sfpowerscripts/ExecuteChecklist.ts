import { flags, SfdxCommand, FlagsConfig } from "@salesforce/command";
import { AnyJson } from "@salesforce/ts-types";
import { Messages, SfdxError } from "@salesforce/core";
import * as inquirer from "inquirer";
import { isNullOrUndefined } from "util";
const yaml = require("js-yaml");
const path = require("path");
const fs = require("fs");
const os = require("os");
const chalk = require("chalk");
const Validator = require('jsonschema').Validator;
import { mkdir } from "shelljs";

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
            description: messages.getMessage("executionLogFlagDescription")
        })
    };

    public async run(): Promise<void> {
        try {
            const filepath: string = this.flags.filepath;
            const executionLog: string = this.flags.executionlog;
            let alias: string = this.flags.alias;


            const result = {};
            if (!isNullOrUndefined(filepath) && isNullOrUndefined(executionLog)) {
                let checklist: checklist = yaml.safeLoad(fs.readFileSync(filepath, "utf8"));
                this.validateChecklist(checklist);

                result["runbook"] = checklist["runbook"];
                result["version"] = checklist["version"];
                result["metadata"] = checklist["metadata"];
                result["schema_version"] = checklist["schema_version"];
                result["alias"] = alias;
                result["tasks"] = checklist["tasks"];

                result["tasks"] = result["tasks"].filter( (task) => {
                    return isNullOrUndefined(task["runOnlyOn"]) || task["runOnlyOn"].toLowerCase() == alias
                });
                result["tasks"].forEach( (task) => {
                    task["status"] = "Unexecuted";
                });
                this.ux.styledHeader(`Executing...`);
            } else if (!isNullOrUndefined(executionLog)) {
                let executionLogJson = JSON.parse(fs.readFileSync(executionLog, "utf8"));

                result["runbook"] = executionLogJson["runbook"];
                result["version"] = executionLogJson["version"];
                result["metadata"] = executionLogJson["metadata"];
                result["schema_version"] = executionLogJson["schema_version"];
                result["alias"] = executionLogJson["alias"];
                result["tasks"] = executionLogJson["tasks"];

                let executionLogChecksum = executionLogJson["checksum"];
                let checksum = this.generateChecksum(executionLogJson);

                if ( (checksum ^ executionLogChecksum) != 0 )
                    throw new Error("Corrupted execution log, please do not manually edit execution log");

                this.ux.styledHeader(`Continuing execution of ${executionLog}`);
            } else {
                throw new Error("Command requires either a checklist --filepath or --executionlog");
            }

            let outputDir: string = path.join(
                this.flags.outputdir,
                alias
            );

            if (!fs.existsSync(outputDir))
                mkdir('-p', outputDir);

            let startDate = new Date();
            let ddmmyyyy = this.getDate(startDate);
            let time = this.getTime(startDate);

            let outputPath = path.join(
                outputDir,
                `execution_log_${ddmmyyyy}${time}`
            );


            console.log(chalk.bold(`Checklist ${result["runbook"]} v${result["version"]}`));
            let taskNum = 0;
            for (let i = 0; i < result["tasks"].length; i++) {
                if ( result["tasks"][i]["status"] == "Done" || result["tasks"][i]["status"] == "Skip") {
                    taskNum++
                    continue;
                } else {
                    taskNum++;
                    this.printTaskInfo(result["tasks"][i], taskNum, result["tasks"].length);

                    let start_timestamp: number = Date.now();
                    let responses: any = await inquirer.prompt([
                        {
                        name: "status",
                        type: "list",
                        message: "Task action:",
                        choices: ["Done", "Skip", "Quit"]
                        },
                        {
                            name: "skip_reason",
                            type: "input",
                            message: "Reason for skipping task?",
                            when: (elem) => {
                                return elem["status"] == "Skip";
                            }
                        },
                        {
                            name: "confirm_exit",
                            type: "confirm",
                            message: "Are you sure?",
                            when: (elem) => {
                                return elem["status"] == "Quit";
                            }
                        }
                    ]);

                    if (responses["confirm_exit"] === false) {
                        // Repeat current task
                        i--
                        taskNum--
                        continue;
                    } else if (responses["confirm_exit"]) {
                        taskNum = -1;
                        break;
                    }

                    let end_timestamp: number = Date.now();
                    let duration_ms = (end_timestamp - start_timestamp);

                    this.printDurationMinSec(duration_ms);

                    result["tasks"][i]["status"] = responses["status"];

                    if (!isNullOrUndefined(responses["skip_reason"]))
                        result["tasks"][i]["reason"] = responses["skip_reason"];

                    result["tasks"][i]["timeTaken"] = duration_ms;
                    result["tasks"][i]["User"] = os.hostname();
                    result["tasks"][i]["Date"] = new Date();


                    let checksum = this.generateChecksum(result);
                    result["checksum"]=checksum;

                    fs.writeFileSync(`${outputPath}.json`, JSON.stringify(result, null, 2));

                    this.generateExecutionLogMarkdown(result, outputPath);
                }
            }
            if (fs.existsSync(`${outputPath}.json`)) {
                // console.log("To resume execution at a later point, pass the execution log to the execute command.");
                console.log(chalk.rgb(0,100,0)(`\nExecution log written to ${outputPath}`));
                console.log(chalk.bold(`\nFinished executing!`));
            } else if (taskNum >= 0) {
                console.log(chalk.bold(`\nNo tasks remaining to execute.`));
            }
        } catch (err) {
            console.error(chalk.red(err.message));
            process.exit(1);
        }
  }

  private printTaskInfo(task, taskNum, nTasks): void {
    console.log(`Progress: Task ` + chalk.bold(`${taskNum}`) + ` of ${nTasks}\n`);
    console.log(chalk.rgb(0,0,255).bold(`${task.task}`));
    console.log(`Id: ${task.id}`);
    console.log(chalk.bold(`\nInstructions:\n`) + `${task.steps}\n`);
  }

  private printDurationMinSec(duration_ms) {
    let duration_sec = duration_ms * Math.pow(10,-3);
    duration_sec = Math.floor(duration_sec);
    let display_minutes = Math.floor(duration_sec / 60);
    let display_seconds = duration_sec % 60;

    console.log(`${display_minutes}m ${display_seconds}s elapsed\n`);
  }

  private getDate(date: Date): string {
    let day = date.getDate();
    let month = date.getMonth();
    let year = date.getFullYear();
    let pad = (n) => n<10 ? '0'+n : n;

    return `${pad(day)}` + `${pad(month+1)}` + `${year}`;
  }

  private getTime(date: Date): string {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    let seconds = date.getSeconds();
    let pad = (n) => n<10 ? '0'+n : n;

    return `${pad(hours)}` + `${pad(minutes)}` + `${pad(seconds)}`;
  }

  private generateExecutionLogMarkdown(executionLogResult, outputPath) {
    try {
        let executionLogResultKeys: string[] = Object.keys(executionLogResult);
        let payload: string = "";
        // executionLogResultHeaderKeys: string[] = executionLogResultKeys.filter( (keys) => {
        //     if ( keys )
        // });
        executionLogResultKeys.forEach( (key) => {
            if (key != "tasks" && key != "checksum") {
                payload += `\n### ${key}: ${executionLogResult[key]}`;
            } else if (key == "tasks") {
                payload += `\n#### Tasks`;
                executionLogResult[key].forEach( (task) => {
                    payload += `\n\n##### Task: ${task["task"]}`;
                    payload += `\n- ID: ${task["id"]}`;
                    payload += `\n- Steps:\n${task["steps"]}`;
                    payload += `\n- Status: ${task["status"]}`;
                    payload += `\n- Time taken: ${task["timetaken"]}`;
                    payload += `\n- User: ${task["User"]}`;
                    payload += `\n- Date: ${task["Date"]}`;
                })
            }
        });

        fs.writeFileSync(`${outputPath}.md`, payload);
    } catch (err) {
        console.warn("Failed to convert execution log to Markdown format");
    }
    // payload = executionLogResult["runbook"];
    // payload += `\n ${executionLogResult["version"]}`;
    // payload += `\n ${executionLogResult["metadata"]}`;
    // payload += `\n ${executionLogResult["schema_version"]}`;
  }

  private generateChecksum(payloadObject) {
    // Generate checksum using Parity Word algorithm

    if (!isNullOrUndefined(payloadObject["checksum"]))
        delete payloadObject["checksum"];

    let payload = JSON.stringify(payloadObject)

    let buffer: number[] = [];
    for (let i=0; i<payload.length; i++) {
        let payload_word = payload.charCodeAt(i);
        buffer.push(payload_word);
    }

    let checksum = buffer[0];
    for (let i = 0; i < buffer.length-1; i++) {
        checksum = checksum ^ buffer[i+1];
    }

    return checksum
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
        "required": [
            "task",
            "id",
            "steps"
        ]
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
            "mode": {
                "type": "string",
                "pattern": /^run-once$|^recurring$/i
            },
            "tasks": {
                "type": "array",
                "items": {
                    "$ref": "/task"
                },
                "minItems": 1
            }
        },
        "required": [
            "runbook",
            "version",
            "metadata",
            "schema_version",
            "mode",
            "tasks"
        ]
    };

    v.addSchema(taskSchema, '/task');
    let validationResult = v.validate(checklist, refSchema);

    if (validationResult.errors.length > 0) {
        let errorMsg: string =
            `Checklist does not meet schema requirements, ` +
            `found ${validationResult.errors.length} validation errors:\n`;

        validationResult.errors.forEach( (error, errorNum) => {
            errorMsg += `\n${errorNum+1}. ${error.stack}`;
            if (!isNullOrUndefined(error.instance))
                errorMsg += `\nReceived: ${JSON.stringify(error.instance)}\n`;
        });
        throw new Error(errorMsg);
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
