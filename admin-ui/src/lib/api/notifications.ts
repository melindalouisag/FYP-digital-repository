import type { NotificationItem } from '../types/workflow';
import { getJson } from './http';

export const notificationsApi = {
  list(limit = 8): Promise<NotificationItem[]> {
    return getJson(`/api/notifications?limit=${limit}`);
  },
};
