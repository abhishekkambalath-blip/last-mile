// The bands shown on the Connect devices page. This list is always visible; the server says which ones can be connected.
export const CATALOG = [
  { id: "whoop", name: "WHOOP", note: "Imports your running workouts from WHOOP." },
  { id: "polar", name: "Polar", note: "Imports your running exercises from Polar Flow." },
  { id: "coros", name: "COROS", note: "Needs COROS partner approval before it can be turned on." },
] as const;
