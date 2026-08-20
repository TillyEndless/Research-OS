import express from "express";
import path from "node:path";

import {
  getDashboardSnapshot,
} from "../services/getDashboardSnapshot.js";


const app =
  express();


const PORT =
  Number(
    process.env.RESEARCH_OS_DASHBOARD_PORT
    ?? 3001,
  );


const dashboardDir =
  path.resolve(
    process.cwd(),
    "dashboard",
  );


app.get(
  "/api/dashboard",
  (_request, response) => {

    try {

      const snapshot =
        getDashboardSnapshot();


      response.json(
        snapshot,
      );

    } catch (error) {

      response
        .status(500)
        .json({
          error:
            error instanceof Error
              ? error.message
              : String(error),
        });
    }
  },
);


app.use(
  express.static(
    dashboardDir,
  ),
);


app.get(
  "/",
  (_request, response) => {

    response.sendFile(
      path.join(
        dashboardDir,
        "index.html",
      ),
    );
  },
);


app.listen(
  PORT,
  "127.0.0.1",
  () => {

    console.log(
      "======================================",
    );

    console.log(
      "ResearchOS Dashboard",
    );

    console.log(
      "======================================",
    );

    console.log(
      `http://127.0.0.1:${PORT}`,
    );
  },
);
