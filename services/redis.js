/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

const redis = require('redis');
const config = require('./config');

// In-memory fallback
const memoryCache = new Map();

const client = redis.createClient({
  socket: {
    host: config.redisHost,
    port: config.redisPort,
    reconnectStrategy: (retries) => {
      if (retries > 5) {
        console.log("[Redis] Too many retries, switching to in-memory cache.");
        return new Error("Too many retries");
      }
      return Math.min(retries * 50, 500);
    }
  }
});

let redisAvailable = false;

client.on('error', (err) => {
  // Suppress heavy logging after fallback
  if (redisAvailable) {
    console.warn('[Redis] Connection lost, switching to memory.', err.message);
  }
  redisAvailable = false;
});

client.on('ready', () => {
  console.log('[Redis] Connected and ready.');
  redisAvailable = true;
});

// Attempt to connect cleanly
client.connect().catch(err => {
  console.warn("[Redis] Initialization failed, using in-memory cache.");
});

module.exports = class Cache {
  static async insert(key) {
    /**
     * As of when this was written, the redis client doesn't support
     * setting a TTL on members of the set dataytype. Instead, we'll
     * use the standard hash map with a dummy value to mimic one.
    */
    if (redisAvailable && client.isOpen) {
      try {
        await client.set(key, "");
        // Assume that most "delivered / read" webhooks will happen within
        // 15 seconds.
        await client.expire(key, 15);
        return;
      } catch (e) {
        console.warn("[Redis] Write failed, using memory:", e.message);
        redisAvailable = false;
      }
    }

    // Fallback
    memoryCache.set(key, Date.now() + 15000); // 15s expiry roughly
  }

  static async remove(key) {
    if (redisAvailable && client.isOpen) {
      try {
        let resp = await client.del(key);

        /**
         * Optionally, your application can measure / report the ingress latency
         * from Cloud API webhooks via Redis's TTL.
         * Ex.
         *      someLoggingFunc(client.ttl(key));
        */

        return resp > 0;
      } catch (e) {
        console.warn("[Redis] Read failed, using memory:", e.message);
        redisAvailable = false;
      }
    }

    // Fallback
    const expiry = memoryCache.get(key);
    if (expiry && expiry > Date.now()) {
      memoryCache.delete(key);
      return true;
    }
    memoryCache.delete(key); // Cleanup
    return false;
  }

  /**
   * Adds a message to the conversation history
   */
  static async addToHistory(psid, role, content) {
    const key = `history:${psid}`;
    const value = JSON.stringify({ role, content });

    if (redisAvailable && client.isOpen) {
      try {
        await client.lPush(key, value);
        await client.lTrim(key, 0, 10); // Keep last 10 messages
        await client.expire(key, 86400); // 24 hours
        return;
      } catch (e) {
        console.warn("[Redis] History write failed:", e.message);
      }
    }

    // Fallback
    if (!memoryCache.has(key)) memoryCache.set(key, []);
    const history = memoryCache.get(key);
    history.unshift({ role, content });
    if (history.length > 10) history.pop();
  }

  /**
   * Gets conversation history
   */
  static async getHistory(psid, limit = 10) {
    const key = `history:${psid}`;

    if (redisAvailable && client.isOpen) {
      try {
        const history = await client.lRange(key, 0, limit - 1);
        return history.map(item => JSON.parse(item)).reverse();
      } catch (e) {
        console.warn("[Redis] History read failed:", e.message);
      }
    }

    // Fallback
    return (memoryCache.get(key) || []).slice().reverse();
  }

  /**
   * Sets the handoff status (true = human, false = AI)
   */
  static async setHandoff(psid, status) {
    const key = `handoff:${psid}`;
    if (redisAvailable && client.isOpen) {
      try {
        await client.set(key, status ? "true" : "false");
        await client.expire(key, 86400); // 24 hours
        return;
      } catch (e) {
        console.warn("[Redis] Handoff write failed:", e.message);
      }
    }

    // Fallback
    memoryCache.set(key, status);
  }

  /**
   * Gets the handoff status
   */
  static async getHandoff(psid) {
    const key = `handoff:${psid}`;
    if (redisAvailable && client.isOpen) {
      try {
        const val = await client.get(key);
        return val === "true";
      } catch (e) {
        console.warn("[Redis] Handoff read failed:", e.message);
      }
    }

    // Fallback
    return !!memoryCache.get(key);
  }
}
