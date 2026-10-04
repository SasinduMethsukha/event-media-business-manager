import { repository } from '../api/repository.js';
export const equipmentService = {
  inventory: repository('equipment_inventory'),
  rentals: repository('owned_equipment_hires'),
  supplierRentals: repository('equipment_rentals')
};
