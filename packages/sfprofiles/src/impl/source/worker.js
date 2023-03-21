import { resolve } from 'path';
import { workerData } from 'worker_threads';

if (workerData.path.endsWith('.ts')) require('ts-node').register();

require(resolve(__dirname, workerData.path));
