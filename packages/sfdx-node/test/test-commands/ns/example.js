"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const command_1 = require("@salesforce/command");
class ExampleCommand extends command_1.default {
    async run() {
        console.log('example command');
    }
}
exports.default = ExampleCommand;
