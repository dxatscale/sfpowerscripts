
const SPFOWERSCRIPTS_DEFAULT_LINUX_SHELL=`sh`;

export default function defaultLinuxShell(): string {
  return process.env.SPFOWERSCRIPTS_DEFAULT_LINUX_SHELL
        ? process.env.SPFOWERSCRIPTS_DEFAULT_LINUX_SHELL
        : SPFOWERSCRIPTS_DEFAULT_LINUX_SHELL
  
}
