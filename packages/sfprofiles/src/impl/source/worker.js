import { resolve } from 'path';
import { workerData } from 'worker_threads';

if (workerData.path.endsWith('.ts')) require('ts-node').register();

try {
    require(resolve(__dirname, workerData.path));
} catch (err) {
    console.log(err)
}
