"use strict";

const config = require("./config");
const GraphApi = require('./graph-api');
const Message = require('./message');
const Cache = require('./redis');
const { generateAIResponse } = require('./ai-response');

/**
 * Sends an AI response with memory and rich UI support
 * @param {string} senderPsid - The PSID of the recipient
 * @param {string} messageText - The text of the received message
 */
async function sendAIResponse(senderPsid, messageText) {
  try {
    // 1. Check for manual handoff
    const isHandoff = await Cache.getHandoff(senderPsid);
    if (isHandoff) {
      console.log(`[Conversation] ${senderPsid} is in handoff mode. Silent.`);
      return;
    }

    // 2. Manage History
    const history = await Cache.getHistory(senderPsid);
    await Cache.addToHistory(senderPsid, "user", messageText);

    // 3. Generate AI Response
    const result = await generateAIResponse(messageText, history);
    console.log(`[Conversation] AI Result for ${senderPsid}:`, result.text.substring(0, 30) + "...");

    // 4. Handle AI-triggered Handoff
    if (result.handoff) {
      await Cache.setHandoff(senderPsid, true);
      return GraphApi.sendTextMessage(senderPsid, "🤝 Je passe le relais à un humain. Un membre de l'équipe va vous répondre ici. Tapez 'reprendre' pour réactiver l'IA.");
    }

    // 5. Save AI response to history
    await Cache.addToHistory(senderPsid, "assistant", result.text);

    // 6. Send Rich UI if applicable
    if (result.carousel) {
      // Send text first
      await GraphApi.sendTextMessage(senderPsid, result.text);
      // Then send Carousel
      return GraphApi.sendCarousel(senderPsid, result.carousel.map(item => ({
        title: item.title,
        subtitle: item.subtitle,
        image_url: item.image_url,
        buttons: [{ type: "postback", title: "Commander", payload: `ORDER_${item.title.toUpperCase()}` }]
      })));
    }

    if (result.quick_replies) {
      return GraphApi.sendQuickReplies(
        senderPsid,
        result.text,
        result.quick_replies.map(q => ({ content_type: "text", title: q, payload: `QR_${q.toUpperCase()}` }))
      );
    }

    // Standard text fallback
    return GraphApi.sendTextMessage(senderPsid, result.text);

  } catch (error) {
    console.error('[Conversation] Error in AI pipeline:', error.message);
    return GraphApi.sendTextMessage(senderPsid, "Désolé, je rencontre un petit bug technique. 😅 Réessayez dans un instant !");
  }
}

module.exports = class Conversation {
  static async handleMessage(senderPsid, messagingEvent) {
    const message = new Message(messagingEvent);
    const textLower = (message.text || "").toLowerCase();

    // 1. Handoff Control Keywords
    const isHandoff = await Cache.getHandoff(senderPsid);

    if (textLower.includes("humain") || textLower.includes("agent") || textLower.includes("support")) {
      await Cache.setHandoff(senderPsid, true);
      return GraphApi.sendTextMessage(senderPsid, "🤝 D'accord, je me mets en pause. Un agent va vous répondre. Tapez 'reprendre' pour revenir à l'IA.");
    }

    if (isHandoff && (textLower.includes("reprendre") || textLower.includes("resume") || textLower.includes("bot"))) {
      await Cache.setHandoff(senderPsid, false);
      return GraphApi.sendTextMessage(senderPsid, "🤖 De retour ! Je suis prêt à vous aider à nouveau.");
    }

    // 2. Route messaging events
    if (message.isTextMessage() && message.hasText()) {
      return sendAIResponse(senderPsid, message.text);
    }

    if (message.type === 'postback' || message.type === 'quick_reply') {
      const input = message.text || message.payload;
      console.log(`[Conversation] UI Interaction: ${input}`);

      // Handle special payloads
      if (message.payload === 'GET_MENU') return sendAIResponse(senderPsid, "Montre-moi le menu");
      if (message.payload === 'GET_HOURS') return sendAIResponse(senderPsid, "Quels sont vos horaires ?");
      if (message.payload === 'HUMAN_HANDOFF') {
        await Cache.setHandoff(senderPsid, true);
        return GraphApi.sendTextMessage(senderPsid, "🤝 Demande d'humain reçue. Je m'arrête.");
      }

      return sendAIResponse(senderPsid, input);
    }

    // Default for media/unsupported
    if (message.type === 'image' || message.type === 'video') {
      return GraphApi.sendTextMessage(senderPsid, "C'est joli ! Mais je suis plus doué avec le texte. 📝");
    }
  }
};