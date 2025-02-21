import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import xlsx from "xlsx";

import { parcel_automation } from "./parcel_automation.js";
import { processTrackingIds } from "./queue.js";
import { saveToDatabase, fetchFromDatabase } from "./db.js";
import { clients } from "./client.js";

import cors from "cors";

dotenv.config();
// server initialization
const app = express();
app.use(express.json());
app.use(cors());
const PORT = process.env.PORT;
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.get("/events/:email", (req, res) => {
  const { email } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.flushHeaders();
  clients[email] = res;

  console.log(`client connected with email: ${email}`);
  // Send an initial connection message
  res.write(
    `data: ${JSON.stringify({ message: "Connected successfully" })}\n\n`
  );

  // //Keep connection alive with a periodic heartbeat
  // const heartbeat = setInterval(() => {
  //   res.write(`data: ${JSON.stringify({ ping: "keep-alive" })}\n\n`);
  // }, 30000);

  req.on("close", () => {
    console.log(`client disconnected: ${email}`);
    // clearInterval(heartbeat);
    delete clients[email];
  });
});

app.post("/track", async (req, res) => {
  const { email, trackingId } = req.body;
  const timestamp = new Date().toISOString().replace("T", " ").replace("Z", "");

  if (!trackingId || !email) {
    return res.status(400).json({
      success: false,
      message: "Invalid email or tracking ID..",
    });
  }
  let result = null;
  let error = null;
  try {
    res.status(200).json({
      message: "Processing has been started we will notify later..",
      timestamp,
    });
    await parcel_automation(trackingId);
    result = "success";

    if (clients[email]) {
      clients[email].write(
        `event:processed\ndata: ${JSON.stringify({
          trackingId,
          success: true,
          message: "Delivery change request submitted",
        })}\n\n`
      );
    }
  } catch (err) {
    error = err;
    result = null;
    if (clients[email]) {
      clients[email].write(
        `event:processed\ndata: ${JSON.stringify({
          trackingId,
          success: false,
          error: err.message,
        })}\n\n`
      );
    }
  } //finally {
  // storing in database
  //   const results = {
  //     success: result ? [trackingId] : [],
  //     failed: result ? [] : [{ trackingId, error: error.message }],
  //   };

  //   saveToDatabase(results, timestamp)
  //     .then(() => {
  //       console.log("data saved succefully");
  //     })
  //     .catch((error) => {
  //       console.log(error);
  //     });
  //   //end--
  // }
});

app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "Server is healthy" });
});

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded" });
  }

  const mimeType = req.file.mimetype;
  const fileBuffer = req.file.buffer;
  const { email } = req.body;
  const timestamp = new Date().toISOString().replace("T", " ").replace("Z", "");
  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Invalid email",
    });
  }
  if (
    ![
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ].includes(mimeType)
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid file format! Please upload an Excel file (.xlsx, .xls).",
    });
  }

  try {
    const workbook = xlsx.read(fileBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
    });
    const trackingIds = jsonData
      .map((row) => (Array.isArray(row) ? row[0] : undefined))
      .filter((value) => value !== undefined);
    console.log(trackingIds);
    if (trackingIds.length == 1)
      return res.status(400).json({
        success: false,
        message: "No Tracking Id found in the uploaded file..",
      });

    res.status(200).json({
      message: "Processing has been started we will notify later..",
      timestamp,
    });

    const result = await processTrackingIds(trackingIds.slice(1), email);

    // // storing in database
    // saveToDatabase(result, timestamp)
    //   .then(() => {
    //     console.log("data saved succefully");
    //   })
    //   .catch((error) => {
    //     console.log(error);
    //   });
    // //end--
    if (clients[email]) {
      clients[email].write(
        `event:processed\ndata: ${JSON.stringify({
          message: "processing completed",
          successId: result.success,
          failedId: result.failed,
        })}\n\n`
      );
    }
  } catch (error) {
    console.error(error);
    if (clients[email]) {
      clients[email].write(
        `event:processed\ndata:${JSON.stringify({
          success: false,
          message: "Failed to process the uploaded file",
        })}\n\n`
      );
    }
  }
});

app.post("/fetch", (req, res) => {
  const { email, timestamp } = req.body;

  fetchFromDatabase(email, timestamp)
    .then((result) => {
      if (result.length == 0)
        res.status(404).json({ message: "No record found" });

      res.status(200).json({ data: result });
    })
    .catch((error) => {
      res.status(500).json({ error: "Internal server error" });
    });
});
app.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));
