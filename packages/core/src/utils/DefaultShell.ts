
const SPFOWERSCRIPTS_DEFAULT_SHELL=`sh`;

export default function defaultShell(): string {
  return process.env.SPFOWERSCRIPTS_DEFAULT_SHELL
        ? process.env.SPFOWERSCRIPTS_DEFAULT_SHELL
        : SPFOWERSCRIPTS_DEFAULT_SHELL
  
}
