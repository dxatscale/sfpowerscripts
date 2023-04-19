import { ExecOptions } from "child_process";


const MAX_BUFFER_DEFAULT: number = 1024 * 1024 * 5; // 5MB

export default function defaultProcessOptions(): ExecOptions {
    return {
        maxBuffer: process.env.SFPOWERSCRIPTS_PROCESS_MAX_BUFFER
            ? Number.parseInt(process.env.SFPOWERSCRIPTS_PROCESS_MAX_BUFFER)
            : MAX_BUFFER_DEFAULT,
    };
}
