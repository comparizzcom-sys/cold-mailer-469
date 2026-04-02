export const defaultTimezones = [
  { value: "UTC", label: "UTC" },
  { value: "Asia/Kolkata", label: "India · Kolkata" },
  { value: "Asia/Dubai", label: "UAE · Dubai" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Tokyo", label: "Japan · Tokyo" },
  { value: "Europe/London", label: "UK · London" },
  { value: "Europe/Berlin", label: "Germany · Berlin" },
  { value: "America/New_York", label: "US East · New York" },
  { value: "America/Chicago", label: "US Central · Chicago" },
  { value: "America/Denver", label: "US Mountain · Denver" },
  { value: "America/Los_Angeles", label: "US West · Los Angeles" },
  { value: "Australia/Sydney", label: "Australia · Sydney" },
] as const;

export function getSupportedTimezones() {
  return defaultTimezones;
}
