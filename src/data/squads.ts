import groupA from "./squad-rosters/group-a.json";
import groupB from "./squad-rosters/group-b.json";
import groupC from "./squad-rosters/group-c.json";
import groupD from "./squad-rosters/group-d.json";
import groupE from "./squad-rosters/group-e.json";
import groupF from "./squad-rosters/group-f.json";
import groupG from "./squad-rosters/group-g.json";
import groupH from "./squad-rosters/group-h.json";
import groupI from "./squad-rosters/group-i.json";
import groupJ from "./squad-rosters/group-j.json";
import groupK from "./squad-rosters/group-k.json";
import groupL from "./squad-rosters/group-l.json";

export type PlayerPosition = "GK" | "DEF" | "MID" | "FWD";

export interface Player {
    name: string;
    pos: PlayerPosition;
    club?: string;
}

export const SQUADS: Record<string, Player[]> = {
    ...(groupA as Record<string, Player[]>),
    ...(groupB as Record<string, Player[]>),
    ...(groupC as Record<string, Player[]>),
    ...(groupD as Record<string, Player[]>),
    ...(groupE as Record<string, Player[]>),
    ...(groupF as Record<string, Player[]>),
    ...(groupG as Record<string, Player[]>),
    ...(groupH as Record<string, Player[]>),
    ...(groupI as Record<string, Player[]>),
    ...(groupJ as Record<string, Player[]>),
    ...(groupK as Record<string, Player[]>),
    ...(groupL as Record<string, Player[]>),
};
