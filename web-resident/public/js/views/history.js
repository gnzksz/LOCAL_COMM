import { createHistoryView } from '../history-view.js';
import { watchMyRequests } from '../service.js';

// Every status update of all my reports (its own page, apart from Notifications).
export const { mount } = createHistoryView({
  watchList: (user, cb) => watchMyRequests(user.id, cb),
  link: (id) => `#/reports/${id}`,
  subtitle: 'Every status update of all your reports, live.',
});
