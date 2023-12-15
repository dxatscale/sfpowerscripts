const sfp_DEFAULT_SHELL = `sh`;

export default function defaultShell(): string {
    return process.env.sfp_DEFAULT_SHELL
        ? process.env.sfp_DEFAULT_SHELL
        : sfp_DEFAULT_SHELL;
}
