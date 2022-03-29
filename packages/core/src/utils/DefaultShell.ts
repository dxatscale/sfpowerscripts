const SFPOWERSCRIPTS_DEFAULT_SHELL = `sh`;

export default function defaultShell(): string {
    return process.env.SFPOWERSCRIPTS_DEFAULT_SHELL
        ? process.env.SFPOWERSCRIPTS_DEFAULT_SHELL
        : SFPOWERSCRIPTS_DEFAULT_SHELL;
}
