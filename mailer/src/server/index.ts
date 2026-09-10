import path from "node:path";
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import expressLayouts from "express-ejs-layouts";

import dashboardRouter from "./routes/dashboard";
import campaignsRouter from "./routes/campaigns";
import settingsRouter from "./routes/settings";
import trackingRouter from "./routes/tracking";
import { startScheduler } from "../scheduler";

const app = express();

app.set("views", path.join(__dirname, "..", "templates", "views"));
app.set("view engine", "ejs");
app.use(expressLayouts);
app.set("layout", "layout");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "..", "public")));
app.use(
  "/vendor/bootstrap",
  express.static(path.join(__dirname, "..", "..", "node_modules", "bootstrap", "dist"))
);

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.query = req.query;
  next();
});

app.use("/", dashboardRouter);
app.use("/campaigns", campaignsRouter);
app.use("/settings", settingsRouter);
// без префикса: короткие публичные ссылки для трекинг-пикселя и отписки в письмах
app.use("/", trackingRouter);

app.use((req, res) => {
  res.status(404).render("404");
});

const port = Number(process.env.APP_PORT ?? 3000);
app.listen(port, () => {
  console.log(`mailer запущен на порту ${port}`);
  startScheduler();
});
