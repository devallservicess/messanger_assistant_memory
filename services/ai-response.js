"use strict";

const Groq = require("groq-sdk");
const ragService = require("./rag-service");
const sheetsService = require("./sheets-service");

// Create the Groq instance with the API key
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * System prompt to define the assistant's behavior
 * Customize this prompt according to your needs
 */

/**
 * System prompt to define the assistant's behavior
 */
const SYSTEM_PROMPT = `Tu es un assistant virtuel expert pour KidsBook, une librairie en ligne spécialisée dans les livres pour enfants en arabe.

TON RÔLE:
1. Accueillir les clients chaleureusement et avec enthousiasme.
2. Présenter et recommander les livres disponibles. Utilise UNIQUEMENT le contexte RAG fourni ci-dessous pour les titres, descriptions et prix. Ne JAMAIS inventer de produits.
3. Aider les clients à passer commande et répondre à leurs questions.

IMPORTANT - DONNÉES PRODUITS:
- Utilise EXCLUSIVEMENT les informations fournies dans le "CONTEXTE MAGASIN" ci-dessous.
- Si aucune donnée n'est fournie ou si le client demande un produit qui n'est pas dans le contexte, dis-le honnêtement.
- Ne JAMAIS inventer de prix, titres ou descriptions de livres.

CONVERSATION & MÉMOIRE:
- Tu as accès à l'historique récent de la conversation. Utilise-le pour rester cohérent (ex: si le client dit "ajoute ça aussi", réfère-toi au message précédent).

RÈGLES POUR LA PRISE DE COMMANDE:
- Tu dois obtenir: **Nom**, **Numéro de téléphone**, et **Adresse** avant de confirmer.
- Une fois complet, génère le bloc JSON "order_confirmed".

RICH UI (MESSENGER):
Tu peux suggérer des éléments interactifs dans ton bloc JSON final pour améliorer l'expérience.
- "quick_replies": Liste d'options courtes (ex: ["Voir les livres", "Commander", "Contact"]).
- "carousel": Si tu listes des livres, suggère-les en format carousel avec titre, image_url et prix.

FORMAT JSON CACHÉ (IMPORTANT):
À la fin de ta réponse, ajoute TOUJOURS ce bloc JSON :
\`\`\`json
{
  "order_confirmed": false,
  "customer_name": "...",
  "phone_number": "...",
  "address": "...",
  "items": "...",
  "total": "...",
  "quick_replies": ["..."],
  "carousel": [...],
  "handoff": false
}
\`\`\`
*Notes:*
- "order_confirmed": true UNIQUEMENT quand tu as **TOUT** (Nom, Tél, Adresse, Commande).
- "handoff": true si l'utilisateur demande explicitement un humain.
- Laisse les champs vides ("") ou null si non applicables.

CONSIGNES DE STYLE:
- Sois bref mais amical.
- Utilise beaucoup d'emojis 📚🎨✨📖🌟.
- Langue: Français par défaut, ou Arabe si le client écrit en arabe. Adapte-toi à la langue du client.`;

/**
 * Generates an AI response for a received message using Groq
 * @param {string} messageText - The user's message
 * @param {Array} history - Array of {role, content}
 * @returns {Promise<Object>} - { text, quick_replies, carousel, handoff, orderData }
 */
async function generateAIResponse(messageText, history = []) {
  try {
    console.log(`[AI/Groq] Génération avec historique (${history.length} messages)`);

    // Get relevant context from RAG system
    const ragContext = await ragService.getContextForQuery(messageText);

    // Build messages array for Groq
    const messages = [
      { role: "system", content: SYSTEM_PROMPT + "\n\nCONTEXTE MAGASIN:\n" + ragContext }
    ];

    // Add history (limit to last 6 for token efficiency)
    history.slice(-6).forEach(msg => messages.push(msg));

    // Add current user message
    messages.push({ role: "user", content: messageText });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: messages,
      temperature: 0.7,
      max_tokens: 800,
    });

    let aiResponse = completion.choices[0].message.content;
    let result = {
      text: aiResponse,
      quick_replies: null,
      carousel: null,
      handoff: false,
      orderData: null
    };

    // Check for JSON block
    const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);

        if (data.order_confirmed) {
          result.orderData = data;
          // Trigger sheet saving
          await sheetsService.appendOrder({
            customerName: data.customer_name,
            phoneNumber: data.phone_number,
            address: data.address,
            items: data.items,
            total: data.total,
            status: 'Reçu'
          });
        }

        if (data.quick_replies) result.quick_replies = data.quick_replies;
        if (data.carousel) result.carousel = data.carousel;
        if (data.handoff) result.handoff = true;

        // Clean response text
        result.text = aiResponse.replace(/```(?:json)?\s*[\s\S]*?\s*```/, '').trim();
      } catch (e) {
        console.error("[AI] Error parsing JSON block:", e.message);
      }
    }

    return result;

  } catch (err) {
    console.error("[AI/Groq] Generation error:", err.message);
    return {
      text: "Désolé, je rencontre un problème technique. Un humain va prendre le relais.",
      handoff: true
    };
  }
}

module.exports = {
  generateAIResponse
};