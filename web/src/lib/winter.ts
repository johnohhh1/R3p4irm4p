/** Source: supplied Restaurant Winter Weatherization & Extreme Weather Procedures,
 * page 1, PREPARATION only, updated 11.18.2025. Stable IDs survive backups. */
export const WINTER_SOURCE = 'Restaurant Winter Weatherization & Extreme Weather Procedures - updated 11.18.2025, page 1, Preparation'
export const WINTER_STEPS = [
  { id: 'irrigation', group: 'Building & exterior', title: 'Winterize lawn irrigation', text: 'Early November, have the lawn irrigation system professionally shut down and all lines blown out with compressed air.' },
  { id: 'doors', group: 'Building & exterior', title: 'Check exterior doors', text: 'Check all exterior doors for adequate weatherstripping and make sure each door closer is working.' },
  { id: 'caulking', group: 'Building & exterior', title: 'Check window and door caulking', text: 'Check all windows and doors for caulking.' },
  { id: 'vestibule', group: 'Building & exterior', title: 'Verify vestibule heaters', text: 'Turn on the front vestibule heaters, if applicable. Verify the thermostat setting and check operation.', optional: true },
  { id: 'thermostats', group: 'Building & exterior', title: 'Verify temperature schedules', text: 'Monitor building temperatures. Confirm occupied and unoccupied thermostat temperatures and the correct times.' },
  { id: 'restrooms', group: 'Building & exterior', title: 'Verify restroom baseboard heaters', text: 'Turn on restroom baseboard heaters, if applicable. Verify thermostat settings and operation.', optional: true },
  { id: 'spigots', group: 'Building & exterior', title: 'Shut off outside spigots', text: 'Ensure all outside spigots are turned off and hoses are stored for the winter.' },
  { id: 'ice-melt', group: 'Seasonal readiness', title: 'Confirm the ice-melt standard', text: 'Use ice-melt from the mainline distributor. Do not use rock salt or water softener salt on sidewalks. Avoid putting ice-melt on landscaping.' },
  { id: 'snow', group: 'Seasonal readiness', title: 'Confirm the snow-clearing standard', text: 'When clearing snow from walkways, avoid piling it onto landscaping. Ensure all sidewalks and accessible parking spaces are fully cleared from curb to curb.' },
  { id: 'heat-tape', group: 'Mechanical room', title: 'Check heat tape and pipe insulation', text: 'Check the operation of the heat tape and the insulation on all water pipes.' },
  { id: 'mechanical-heater', group: 'Mechanical room', title: 'Verify the mechanical room heater', text: 'Turn on the mechanical room heater. Verify the thermostat setting and operation. Ensure it is blowing hot air, not just air.' },
  { id: 'mechanical-door', group: 'Mechanical room', title: 'Check the mechanical room door', text: 'Check the door for proper weatherstripping and function of the lock.' },
] as const
export const WINTER_STATUSES = { pending: 'Not started', done: 'Complete', attention: 'Needs attention', na: 'Not applicable' } as const
export function winterCounts(results: import('./types').Project['winterPreparation']) {
  return Object.fromEntries(Object.keys(WINTER_STATUSES).map(status => [status, WINTER_STEPS.filter(step => (results?.[step.id]?.status ?? 'pending') === status).length])) as Record<keyof typeof WINTER_STATUSES, number>
}
