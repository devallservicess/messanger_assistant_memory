"use strict";

require("dotenv").config();
const axios = require('axios');

async function debug() {
    const token = process.env.ACCESS_TOKEN;
    console.log("--- Token Debug ---");
    try {
        const resp = await axios.get(`https://graph.facebook.com/debug_token?input_token=${token}&access_token=${token}`);
        console.log(JSON.stringify(resp.data, null, 2));
    } catch (err) {
        console.log("Debug failed. This is likely because the token is not an App Access Token which is needed for debug_token, or it's invalid.");
        // Try /me
        try {
            console.log("Trying /me...");
            const meResp = await axios.get(`https://graph.facebook.com/me?access_token=${token}`);
            console.log("ME RESULTS:", meResp.data);
        } catch (meErr) {
            console.error("ME failed:", meErr.response ? meErr.response.data : meErr.message);
        }
    }
}

debug();
