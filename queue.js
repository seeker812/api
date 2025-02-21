import { Worker } from "worker_threads";
import PQueue from "p-queue";
import { clients } from "./client.js";
const queue = new PQueue({ concurrency: 4 });

async function runWorker(trackingId, email) {
  return new Promise(function (resolve, reject) {
    const worker = new Worker("./worker.js", {
      workerData: { trackingId },
    });

    worker.on("message", (message) => {
      if (message.success) {
        if (clients[email]) {
          clients[email].write(
            `event:single\ndata:${JSON.stringify({
              trackingId,
              success: true,
            })}`
          );
        }

        resolve({ trackingId, success: true });
      } else {
        if (clients[email]) {
          clients[email].write(
            `event:single\ndata:${JSON.stringify({
              trackingId,
              success: false,
              error: message.message,
            })}\n\n`
          );
        }

        resolve({ trackingId, success: false, error: message.message });
      }
    });

    worker.on("error", (error) => {
      if (clients[email]) {
        clients[email].write(
          `event:single\ndata:${JSON.stringify({
            trackingId,
            success: false,
            error: message.message,
          })}\n\n`
        );
      }

      resolve({ trackingId, success: false, error: error.message });
    });

    worker.on("exit", (code) => {
      if (code != 0) {
        if (clients[email]) {
          clients[email].write(
            `event:single\ndata:${JSON.stringify({
              trackingId,
              success: false,
              error: `worker exited with code ${code}`,
            })}\n\n`
          );
        }
      }

      resolve({
        trackingId,
        success: false,
        error: `worker exited with code ${code}`,
      });
    });
  });
}

async function processTrackingIds(trackingIds, email) {
  const results = await Promise.all(
    trackingIds.map((id) => queue.add(() => runWorker(id, email)))
  );

  const success = results.filter((r) => r.success).map((r) => r.trackingId);
  const failed = results
    .filter((r) => !r.success)
    .map((r) => ({ trackingId: r.trackingId, error: r.error }));

  return { success, failed };
}

export { processTrackingIds };
