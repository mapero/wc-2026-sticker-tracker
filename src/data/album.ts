import { SQUADS, type Player, type PlayerPosition } from "./squads";

export enum StickerType {
    Badge = "BADGE",
    TeamPhoto = "TEAM_PHOTO",
    Player = "PLAYER",
    Logo = "LOGO",
    Emblem = "EMBLEM",
    Mascot = "MASCOT",
    Ball = "BALL",
    Trophy = "TROPHY",
    Host = "HOST",
    Intro = "INTRO",
    Champion = "CHAMPION",
}

export interface Sticker {
    id: string;
    code: string;
    seq: number;
    section: string;
    sectionTitle: string;
    group: string | null;
    teamName: string | null;
    teamCode: string | null;
    type: StickerType;
    label: string;
    foil: boolean;
    page: number;
    slot: number;
    position?: PlayerPosition;
    club?: string;
}

export interface TeamSection {
    id: string;
    kind: "TEAM";
    name: string;
    code: string;
    flag: string;
    group: string;
    color: string;
    accent: string;
    stickerCodes: string[];
}

export interface IntroSection {
    id: "intro";
    kind: "INTRO";
    name: string;
    title: string;
    flag: string;
    color: string;
    accent: string;
    stickerCodes: string[];
}

export type Section = TeamSection | IntroSection;

type TeamTuple = [name: string, code: string, flag: string, color: string, accent: string];

export const GROUPS: Record<string, TeamTuple[]> = {
    A: [
        ["Mexico", "MEX", "🇲🇽", "#006847", "#ce1126"],
        ["South Africa", "RSA", "🇿🇦", "#007a4d", "#ffb612"],
        ["South Korea", "KOR", "🇰🇷", "#cd2e3a", "#0047a0"],
        ["Czechia", "CZE", "🇨🇿", "#11457e", "#d7141a"],
    ],
    B: [
        ["Canada", "CAN", "🇨🇦", "#d52b1e", "#1a1a1a"],
        ["Bosnia and Herzegovina", "BIH", "🇧🇦", "#002395", "#fecb00"],
        ["Qatar", "QAT", "🇶🇦", "#8a1538", "#b59679"],
        ["Switzerland", "SUI", "🇨🇭", "#d52b1e", "#1a1a1a"],
    ],
    C: [
        ["Brazil", "BRA", "🇧🇷", "#ffdf00", "#009c3b"],
        ["Morocco", "MAR", "🇲🇦", "#c1272d", "#006233"],
        ["Haiti", "HAI", "🇭🇹", "#00209f", "#d21034"],
        ["Scotland", "SCO", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "#0065bf", "#1a1a1a"],
    ],
    D: [
        ["USA", "USA", "🇺🇸", "#2a398d", "#bf0a30"],
        ["Paraguay", "PAR", "🇵🇾", "#d52b1e", "#0038a8"],
        ["Australia", "AUS", "🇦🇺", "#00843d", "#ffcd00"],
        ["Türkiye", "TUR", "🇹🇷", "#e30a17", "#1a1a1a"],
    ],
    E: [
        ["Germany", "GER", "🇩🇪", "#1a1a1a", "#dd0000"],
        ["Curaçao", "CUW", "🇨🇼", "#002b7f", "#f9d90f"],
        ["Ivory Coast", "CIV", "🇨🇮", "#f77f00", "#009e60"],
        ["Ecuador", "ECU", "🇪🇨", "#ffd100", "#0072ce"],
    ],
    F: [
        ["Netherlands", "NED", "🇳🇱", "#ff6c00", "#21468b"],
        ["Japan", "JPN", "🇯🇵", "#0033a0", "#bc002d"],
        ["Sweden", "SWE", "🇸🇪", "#006aa7", "#fecc02"],
        ["Tunisia", "TUN", "🇹🇳", "#e70013", "#1a1a1a"],
    ],
    G: [
        ["Belgium", "BEL", "🇧🇪", "#e30613", "#fdda24"],
        ["Egypt", "EGY", "🇪🇬", "#ce1126", "#1a1a1a"],
        ["Iran", "IRN", "🇮🇷", "#239f40", "#da0000"],
        ["New Zealand", "NZL", "🇳🇿", "#1a1a1a", "#888888"],
    ],
    H: [
        ["Spain", "ESP", "🇪🇸", "#c60b1e", "#ffc400"],
        ["Cape Verde", "CPV", "🇨🇻", "#003893", "#cf2027"],
        ["Saudi Arabia", "KSA", "🇸🇦", "#006c35", "#1a1a1a"],
        ["Uruguay", "URU", "🇺🇾", "#5cbfeb", "#001489"],
    ],
    I: [
        ["France", "FRA", "🇫🇷", "#21468b", "#ce1126"],
        ["Senegal", "SEN", "🇸🇳", "#00853f", "#fdef42"],
        ["Iraq", "IRQ", "🇮🇶", "#007a3d", "#ce1126"],
        ["Norway", "NOR", "🇳🇴", "#ba0c2f", "#00205b"],
    ],
    J: [
        ["Argentina", "ARG", "🇦🇷", "#75aadb", "#f4d03f"],
        ["Algeria", "ALG", "🇩🇿", "#006233", "#d21034"],
        ["Austria", "AUT", "🇦🇹", "#ed2939", "#1a1a1a"],
        ["Jordan", "JOR", "🇯🇴", "#007a3d", "#ce1126"],
    ],
    K: [
        ["Portugal", "POR", "🇵🇹", "#006600", "#ff0000"],
        ["DR Congo", "COD", "🇨🇩", "#007fff", "#f7d618"],
        ["Uzbekistan", "UZB", "🇺🇿", "#1eb53a", "#0099b5"],
        ["Colombia", "COL", "🇨🇴", "#fcd116", "#003893"],
    ],
    L: [
        ["England", "ENG", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "#f0f0f0", "#ce1124"],
        ["Croatia", "CRO", "🇭🇷", "#ff0000", "#171796"],
        ["Ghana", "GHA", "🇬🇭", "#006b3f", "#fcd116"],
        ["Panama", "PAN", "🇵🇦", "#005293", "#d21034"],
    ],
};

interface IntroDef {
    code: string;
    label: string;
    type: StickerType;
}

const INTRO_STICKERS: IntroDef[] = [
    { code: "00", label: "Panini Logo", type: StickerType.Logo },
    { code: "FWC1", label: "Official Emblem (1)", type: StickerType.Emblem },
    { code: "FWC2", label: "Official Emblem (2)", type: StickerType.Emblem },
    { code: "FWC3", label: "Official Mascots", type: StickerType.Mascot },
    { code: "FWC4", label: "Official Slogan", type: StickerType.Intro },
    { code: "FWC5", label: "Official Match Ball", type: StickerType.Ball },
    { code: "FWC6", label: "Host Country Emblem - Canada", type: StickerType.Host },
    { code: "FWC7", label: "Host Country Emblem - Mexico", type: StickerType.Host },
    { code: "FWC8", label: "Host Country Emblem - USA", type: StickerType.Host },
    { code: "FWC9", label: "World Champions - Italy 1934", type: StickerType.Champion },
    { code: "FWC10", label: "World Champions - Uruguay 1950", type: StickerType.Champion },
    { code: "FWC11", label: "World Champions - Germany FR 1954", type: StickerType.Champion },
    { code: "FWC12", label: "World Champions - Brazil 1962", type: StickerType.Champion },
    { code: "FWC13", label: "World Champions - Germany FR 1974", type: StickerType.Champion },
    { code: "FWC14", label: "World Champions - Argentina 1986", type: StickerType.Champion },
    { code: "FWC15", label: "World Champions - Brazil 1994", type: StickerType.Champion },
    { code: "FWC16", label: "World Champions - Brazil 2002", type: StickerType.Champion },
    { code: "FWC17", label: "World Champions - Italy 2006", type: StickerType.Champion },
    { code: "FWC18", label: "World Champions - Germany 2014", type: StickerType.Champion },
    { code: "FWC19", label: "World Champions - Argentina 2022", type: StickerType.Champion },
];

export const STICKERS_PER_TEAM = 20;
export const PLAYERS_PER_TEAM = 18;
export const PAGE_ONE_SLOTS = 10;
export const TEAM_GRID_COLUMNS = 4;
export const BADGE_SLOT = 1;
export const TEAM_PHOTO_SLOT = 13;

const VALID_POSITIONS: readonly PlayerPosition[] = ["GK", "DEF", "MID", "FWD"];

function assertValidSquad(code: string, squad: unknown): asserts squad is Player[] {
    if (!Array.isArray(squad) || squad.length !== PLAYERS_PER_TEAM) {
        const got = Array.isArray(squad) ? `${squad.length} players` : typeof squad;
        throw new Error(`Roster for ${code} must be an array of ${PLAYERS_PER_TEAM} players, got ${got}.`);
    }
    squad.forEach((p, i) => {
        if (!p || typeof p.name !== "string" || !p.name.trim()) {
            throw new Error(`Roster ${code}[${i}] is missing a valid "name".`);
        }
        if (!VALID_POSITIONS.includes(p.pos)) {
            throw new Error(`Roster ${code}[${i}] (${p.name}) has invalid position "${p.pos}".`);
        }
    });
}

function buildAlbum() {
    const stickers: Sticker[] = [];
    const teams: TeamSection[] = [];
    let seq = 0;

    const introSection: IntroSection = {
        id: "intro",
        kind: "INTRO",
        name: "Introduction",
        title: "Introduction & FIFA Museum",
        flag: "🏆",
        color: "#0b0b0f",
        accent: "#c8a24b",
        stickerCodes: [],
    };
    INTRO_STICKERS.forEach((s, i) => {
        seq += 1;
        stickers.push({
            id: s.code,
            code: s.code,
            seq,
            section: "intro",
            sectionTitle: introSection.title,
            group: null,
            teamName: null,
            teamCode: null,
            type: s.type,
            label: s.label,
            foil: true,
            page: i < 9 ? 1 : 2,
            slot: i + 1,
        });
        introSection.stickerCodes.push(s.code);
    });

    for (const [groupLetter, groupTeams] of Object.entries(GROUPS)) {
        for (const [name, code, flag, color, accent] of groupTeams) {
            const team: TeamSection = {
                id: code,
                kind: "TEAM",
                name,
                code,
                flag,
                group: groupLetter,
                color,
                accent,
                stickerCodes: [],
            };

            const squad = SQUADS[code] ?? [];

            assertValidSquad(code, squad);

            for (let slot = 1; slot <= STICKERS_PER_TEAM; slot++) {
                seq += 1;
                let type: StickerType;
                let label: string;
                let foil = false;
                let position: PlayerPosition | undefined;
                let club: string | undefined;
                if (slot === BADGE_SLOT) {
                    type = StickerType.Badge;
                    label = "Team Badge";
                    foil = true;
                } else if (slot === TEAM_PHOTO_SLOT) {
                    type = StickerType.TeamPhoto;
                    label = "Team Photo";
                } else {
                    type = StickerType.Player;
                    const playerIndex = slot < TEAM_PHOTO_SLOT ? slot - 2 : slot - 3;
                    const player = squad[playerIndex];
                    label = player.name;
                    position = player.pos;
                    club = player.club;
                }
                const sticker: Sticker = {
                    id: `${code}${slot}`,
                    code: `${code}${slot}`,
                    seq,
                    section: code,
                    sectionTitle: name,
                    group: groupLetter,
                    teamName: name,
                    teamCode: code,
                    type,
                    label,
                    foil,
                    page: slot <= PAGE_ONE_SLOTS ? 1 : 2,
                    slot,
                    position,
                    club,
                };
                stickers.push(sticker);
                team.stickerCodes.push(sticker.code);
            }

            teams.push(team);
        }
    }

    const sections: Section[] = [introSection, ...teams];
    const byCode: Record<string, Sticker> = Object.fromEntries(stickers.map((s) => [s.code, s]));

    return { stickers, teams, sections, introSection, byCode };
}

const album = buildAlbum();

export const STICKERS: Sticker[] = album.stickers;
export const TEAMS: TeamSection[] = album.teams;
export const SECTIONS: Section[] = album.sections;
export const INTRO_SECTION: IntroSection = album.introSection;
export const STICKER_BY_CODE: Record<string, Sticker> = album.byCode;
export const TOTAL_STICKERS = STICKERS.length;

export function stickersForSection(sectionId: string): Sticker[] {
    return STICKERS.filter((s) => s.section === sectionId).sort((a, b) => a.slot - b.slot);
}

export const ALBUM_META = {
    title: "FIFA World Cup 2026",
    subtitle: "Unofficial Sticker Tracker",
    publisher: "Panini",
    hosts: "Canada · Mexico · USA",
    total: TOTAL_STICKERS,
    teamCount: TEAMS.length,
    stickersPerTeam: STICKERS_PER_TEAM,
};

export default album;
