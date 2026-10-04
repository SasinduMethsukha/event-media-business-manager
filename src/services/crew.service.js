import { repository } from '../api/repository.js';
export const crewService = {
  members: repository('crew_members'),
  assignments: repository('crew_assignments'),
  payouts: repository('payouts')
};
