/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

const { FacebookAdsApi } = require('facebook-nodejs-business-sdk');
const config = require("./config");

const api = new FacebookAdsApi(config.accessToken);
FacebookAdsApi.setDefaultApi(api);

module.exports = class GraphApi {
  static async #makeApiCall(senderPsid, requestBody) {
    try {
      const response = await api.call(
        'POST',
        [config.pageId, 'messages'],
        requestBody
      );
      console.log('API call successful:', response);
      return response;
    } catch (error) {
      console.error('Error making API call:', error);
      throw error;
    }
  }

  static async markAsRead(senderPsid) {
    try {
      await api.call(
        'POST',
        [config.pageId, 'messages'],
        {
          recipient: { id: senderPsid },
          sender_action: "mark_seen"
        }
      );
    } catch (error) {
      console.warn('[GraphApi] Could not mark message as seen:', error.message);
    }
  }

  static async sendTypingOn(senderPsid) {
    try {
      await api.call(
        'POST',
        [config.pageId, 'messages'],
        {
          recipient: { id: senderPsid },
          sender_action: "typing_on"
        }
      );
    } catch (error) {
      console.warn('[GraphApi] Could not send typing indicator:', error.message);
    }
  }

  /**
   * Sends a simple text message
   * @param {string} senderPsid - The PSID of the recipient
   * @param {string} messageText - The text to send
   * @returns {Promise}
   */
  static async sendTextMessage(senderPsid, messageText) {
    const requestBody = {
      recipient: {
        id: senderPsid
      },
      messaging_type: "RESPONSE",
      message: {
        text: messageText
      }
    };

    await this.markAsRead(senderPsid);
    await this.sendTypingOn(senderPsid);
    console.log('[GraphApi] Sending text message to:', senderPsid);
    return this.#makeApiCall(senderPsid, requestBody);
  }

  /**
   * Sends a generic template message (equivalent to carousel/cards)
   */
  static async sendGenericMessage(senderPsid, elements) {
    const requestBody = {
      recipient: {
        id: senderPsid
      },
      messaging_type: "RESPONSE",
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: elements
          }
        }
      }
    };

    // await this.markAsRead(senderPsid);
    // await this.sendTypingOn(senderPsid);
    return this.#makeApiCall(senderPsid, requestBody);
  }

  /**
   * Sends buttons with text
   */
  static async sendButtonMessage(senderPsid, text, buttons) {
    const requestBody = {
      recipient: {
        id: senderPsid
      },
      messaging_type: "RESPONSE",
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: text,
            buttons: buttons
          }
        }
      }
    };

    // await this.markAsRead(senderPsid);
    // await this.sendTypingOn(senderPsid);
    return this.#makeApiCall(senderPsid, requestBody);
  }

  /**
   * Sets the Messenger Persistent Menu
   */
  static async setPersistentMenu() {
    try {
      const response = await api.call(
        'POST',
        ['me', 'messenger_profile'],
        {
          "persistent_menu": [
            {
              "locale": "default",
              "composer_input_disabled": false,
              "call_to_actions": [
                {
                  "type": "postback",
                  "title": "🛍️ Menu & Commande",
                  "payload": "GET_MENU"
                },
                {
                  "type": "postback",
                  "title": "🕒 Horaires",
                  "payload": "GET_HOURS"
                },
                {
                  "type": "postback",
                  "title": "👤 Parler à un humain",
                  "payload": "HUMAN_HANDOFF"
                }
              ]
            }
          ]
        }
      );
      console.log('[GraphApi] Persistent Menu set successfully');
      return response;
    } catch (error) {
      console.error('[GraphApi] Error setting Persistent Menu:', error.message);
      throw error;
    }
  }

  /**
   * Sends Quick Replies
   * @param {string} senderPsid 
   * @param {string} text 
   * @param {Array} quickReplies - Array of objects { content_type: 'text', title: 'Yes', payload: 'YES' }
   */
  static async sendQuickReplies(senderPsid, text, quickReplies) {
    const requestBody = {
      recipient: {
        id: senderPsid
      },
      messaging_type: "RESPONSE",
      message: {
        text: text,
        quick_replies: quickReplies
      }
    };

    await this.markAsRead(senderPsid);
    await this.sendTypingOn(senderPsid);
    return this.#makeApiCall(senderPsid, requestBody);
  }

  /**
   * Sends a Carousel (Generic Template)
   * @param {string} senderPsid 
   * @param {Array} elements - Array of objects for the carousel cards
   */
  static async sendCarousel(senderPsid, elements) {
    const requestBody = {
      recipient: {
        id: senderPsid
      },
      messaging_type: "RESPONSE",
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: elements
          }
        }
      }
    };

    await this.markAsRead(senderPsid);
    await this.sendTypingOn(senderPsid);
    return this.#makeApiCall(senderPsid, requestBody);
  }

};

