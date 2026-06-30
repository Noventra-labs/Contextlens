/**
 * MCP Notification Manager
 *
 * Push events to connected clients.
 * Tracks event subscriptions and broadcasts notifications.
 */

import { EventEmitter } from 'events';

export enum McpNotificationType {
  EPISODE_STARTED = 'episode/started',
  EPISODE_CLOSED = 'episode/closed',
  GIT_CHANGED = 'git/changed',
  WORKSPACE_CHANGED = 'workspace/changed',
  INDEX_COMPLETE = 'index/complete',
  TOKEN_ROTATED = 'auth/token-rotated',
}

export interface McpNotification {
  type: McpNotificationType;
  timestamp: number;
  data: Record<string, any>;
}

export class NotificationManager {
  private static instance: NotificationManager;
  private emitter = new EventEmitter();
  private history: McpNotification[] = [];
  private maxHistory = 100;

  private constructor() {}

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  /**
   * Emit a notification to all listeners.
   */
  notify(type: McpNotificationType, data: Record<string, any> = {}): void {
    const notification: McpNotification = {
      type,
      timestamp: Date.now(),
      data,
    };

    this.history.push(notification);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    this.emitter.emit('notification', notification);
    this.emitter.emit(type, notification);
  }

  /**
   * Subscribe to all notifications.
   */
  onNotification(callback: (notification: McpNotification) => void): void {
    this.emitter.on('notification', callback);
  }

  /**
   * Subscribe to a specific notification type.
   */
  on(type: McpNotificationType, callback: (notification: McpNotification) => void): void {
    this.emitter.on(type, callback);
  }

  /**
   * Unsubscribe from notifications.
   */
  off(event: string, callback: (...args: any[]) => void): void {
    this.emitter.off(event, callback);
  }

  /**
   * Get recent notifications (for polling clients).
   */
  getRecent(since?: number, limit: number = 20): McpNotification[] {
    let notifications = this.history;
    if (since) {
      notifications = notifications.filter(n => n.timestamp > since);
    }
    return notifications.slice(-limit);
  }

  /**
   * Get notification history count.
   */
  getHistoryCount(): number {
    return this.history.length;
  }
}
