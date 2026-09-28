export const APP_VERSION = '1.1.0';

export const MODES = ['Pointbreak', 'Cashout', 'Ranked', 'Other'];
export const MAPS = ['Bernal', 'Fangwai', 'Fortune', 'Kyoto', 'Monaco', 'Nozomi', 'PEACE Center', 'Seoul', 'Skyway', 'Starlight', 'Sys', 'Vegas', 'Vegas Stadium'];
export const MENTAL = ['Locked', 'Crashing Out', 'Distracted/Tired/Over It'];
export const LAG = ['None', 'Some', 'A lot', 'Unplayable', 'Great Connection', 'Glitch/Bug'];
export const LAGGY = new Set(['Some', 'A lot', 'Unplayable', 'Glitch/Bug']);
export const SKILL = ['All Below', 'All Same', 'All Above', 'Below + Same', 'Below + Above', 'Same + Above', 'Below, Same & Above'];
export const BUILDS = ['Light', 'Medium', 'Heavy'];
export const WTYPES = ['Automatic', 'Poke', 'Burst', 'Melee', 'Sustain'];
export const SPECS = ['Shockwave', 'Demat', 'HealBeam', 'Turret', 'C+S', 'Winch', 'GooGun', 'Shield', 'Invis', 'Dash', 'Grapple', 'Other'];
export const COLORS = ['#ff3d52', '#4dabff', '#ffcc33', '#35d07f', '#c77dff', '#ff8c42', '#2ee6d6', '#f06bb3'];

// 5th/6th and 7th/8th are stored as 5.5 and 7.5 so placement can be averaged and graphed
export const PLACES = [{ v: 1, l: '1st' }, { v: 2, l: '2nd' }, { v: 3, l: '3rd' }, { v: 4, l: '4th' }, { v: 5.5, l: '5th/6th' }, { v: 7.5, l: '7th/8th' }];
export const STAGES = ['Qualified for Final', 'Qualified for 2nd round', 'Knocked out'];
export const stageFor = p => p <= 2 ? STAGES[0] : p <= 4 ? STAGES[1] : STAGES[2];

// Always-present named teammate; other names are added by the user
export const FIXED_FRIEND = 'MommaGerbil';
