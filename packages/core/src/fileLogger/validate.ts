import fs from 'fs';
import { PATH, PROCESSNAME, ValidateFile, ValidateProps } from './types';


export class FileLoggerService {

    public static writeProps(props: ValidateProps): void {
        ValidateFileBuilder.getInstance().buildProps(props).build();
    }

    public static writeStatus(status: 'success' | 'failed' | 'inprogress', message: string): void {
        ValidateFileBuilder.getInstance().buildStatus(status, message).build();
    }
}

class ValidateFileBuilder {
    private file: ValidateFile;
    private static instance: ValidateFileBuilder;

    private constructor() {
        this.file = {
            processName: PROCESSNAME.VALIDATE,
            scheduled: 0,
            success: 0,
            failed: 0,
            elapsedTime: 0,
            status: 'inprogress',
            message: '',
        };
    }

    public static getInstance(): ValidateFileBuilder {
        if (!ValidateFileBuilder.instance) {
            ValidateFileBuilder.instance = new ValidateFileBuilder();
            // Create .sfpowerscripts folder if not exist
            if (!fs.existsSync(PATH.DEFAULT)) {
                fs.mkdirSync(PATH.DEFAULT);
            }
            if (!fs.existsSync(PATH.VALIDATE)) {
                // File doesn't exist, create it
                fs.writeFileSync(PATH.VALIDATE, JSON.stringify(ValidateFileBuilder.instance.file), 'utf-8');
            }
        }

        return ValidateFileBuilder.instance;
    }

    buildProps(props: ValidateProps): ValidateFileBuilder {
        this.file.validateProps = {...props};
        return this;
    }

    buildStatus(status: "inprogress" | "success" | "failed", message: string): ValidateFileBuilder {
        this.file.status = status;
        this.file.message = message;
        return this;
    }

    build(): void {
        fs.writeFileSync(PATH.VALIDATE, JSON.stringify(this.file, null, 2), 'utf-8');
    }
}
