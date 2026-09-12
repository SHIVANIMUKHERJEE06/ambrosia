// env.js
//
// Loads .env BEFORE any other module is imported. ES module imports are
// hoisted and run before any top-level code in the importing file, so
// calling dotenv.config() inside server.js (after its own imports) is
// too late — modules like auth.js or db.js may already have read
// process.env by the time server.js's body executes.
//
// Fix: this file is imported FIRST, with a side-effect-only import
// (`import "./env.js"`), before any other local module is imported
// anywhere in the app. dotenv.config() runs synchronously, so by the
// time the next import statement's module body executes, process.env
// is fully populated.

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });
