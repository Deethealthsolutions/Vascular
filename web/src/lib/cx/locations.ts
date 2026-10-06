// Clinic locations in the network. A staff member works at one location at a time (chosen in
// the sidebar); the patient-journey screens show that location's patients, tokens are numbered
// per location, and Today's patient flow can compare all locations. Access still follows the
// staff member's centres: a location is available if its centre is in their scope.

import type { Registration, State } from "./store";
import type { Staff } from "./users";

/** color/abbr: the location's visual badge — hues kept clear of the red/amber/teal status colours. */
export type Location = { id: string; name: string; city: string; centre: string; short: string; abbr: string; color: string };

export const LOCATIONS: Location[] = [
  { id: "CHN-GR", name: "Greams Road", city: "Chennai", centre: "CHN", short: "Greams Rd", abbr: "GR", color: "#0369a1" },
  { id: "BLR-HSR", name: "HSR Layout", city: "Bengaluru", centre: "BLR", short: "HSR Layout", abbr: "HSR", color: "#6d28d9" },
  { id: "BLR-RJN", name: "Rajajinagar", city: "Bengaluru", centre: "BLR", short: "Rajajinagar", abbr: "RJN", color: "#a21caf" },
  { id: "MYS-1", name: "Mysuru", city: "Mysuru", centre: "BLR", short: "Mysuru", abbr: "MYS", color: "#475569" },
];
export const DEFAULT_LOCATION = LOCATIONS[0].id;

export const locById = (id?: string) => LOCATIONS.find((l) => l.id === id) ?? LOCATIONS[0];
/** Registrations created before locations existed belong to their centre's first location. */
export const locOf = (r: Registration) => r.location ?? LOCATIONS.find((l) => l.centre === r.centre)?.id ?? DEFAULT_LOCATION;
export const myLocations = (me: Staff) => LOCATIONS.filter((l) => me.centres.includes(l.centre as never));
/** The location this staff member is working at now (falls back to their first allowed one). */
export const currentLocation = (st: Pick<State, "location">, me: Staff) => {
  const mine = myLocations(me);
  return mine.find((l) => l.id === st.location) ?? mine[0] ?? LOCATIONS[0];
};
/** Registrations at the staff member's current location — what the journey screens work on. */
export const hereRegs = (st: Pick<State, "location" | "registrations">, me: Staff) => {
  const id = currentLocation(st, me).id;
  return st.registrations.filter((r) => locOf(r) === id);
};
/** Stamp demo registrations with a location (and its centre). */
export const placeAt = (regs: Registration[], id: string): Registration[] => {
  const l = locById(id);
  return regs.map((r) => ({ ...r, location: l.id, centre: l.centre }));
};
