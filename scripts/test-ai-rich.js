"use strict";

require("dotenv").config();
const { generateAIResponse } = require("../services/ai-response");

async function test() {
    console.log("--- AI Rich UI Test ---");
    const result = await generateAIResponse("Montre-moi le menu des pizzas");
    console.log("AI TEXT:", result.text);
    console.log("QUICK REPLIES:", result.quick_replies);
    console.log("CAROUSEL:", result.carousel);
    console.log("HANDOFF:", result.handoff);
}

test();
