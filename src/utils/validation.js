export const rules = {
  required(value, field) {
    if (value === null || value === undefined || String(value).trim() === '') {
      throw new Error(`${field} is required.`);
    }
  },
  money(value, field) {
    if (value === '' || value === null || value === undefined) return;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${field} must be a valid non-negative amount.`);
  },
  email(value, field = 'Email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
      throw new Error(`${field} is not valid.`);
    }
  }
};

export function validate(payload, schema) {
  Object.entries(schema).forEach(([key, checks]) => {
    checks.forEach(check => check(payload[key], key));
  });
  return payload;
}
