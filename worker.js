import { parentPort, workerData } from "node:worker_threads";
import { parcel_automation } from "./parcel_automation.js";

(async () => {
    try {
        const result = await parcel_automation(workerData.trackingId);
        parentPort.postMessage(result);
    } catch (error) {
        parentPort.postMessage(error);
    }
})();
