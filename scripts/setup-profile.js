"use strict";

require("dotenv").config();
const GraphApi = require("../services/graph-api");
const config = require("../services/config");

async function setup() {
    console.log("--- Messenger Profile Setup ---");

    if (!config.accessToken || !config.pageId) {
        console.error("Error: ACCESS_TOKEN and PAGE_ID must be set in .env");
        process.exit(1);
    }

    try {
        console.log("Setting Persistent Menu...");
        await GraphApi.setPersistentMenu();
        console.log("Setup completed successfully!");
    } catch (err) {
        console.error("Setup failed!");
        console.error(err);
    }
}

setup();
