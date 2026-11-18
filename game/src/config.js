// DEL RIO — tuning constants. Every number and colour the game uses lives here,
// so balance and art direction can be retuned without touching the systems.
export const WORLD = { width: 3840, height: 2880 };
export const SEED = 20261117;

// Roads: avenue (vertical) and street (horizontal) centre lines, in world px.
export const AVENUES = [320, 800, 1280, 1760, 2240, 2720, 3600];
export const STREETS = [320, 800, 1280, 1760, 2240];
export const ROAD_HALF = 48;
export const HIGHWAY_Y = 2620;
export const HIGHWAY_HALF = 58;

// Rio Seco: turquoise river band down the east side, crossed by three bridges —
// the two street bridges and the canyon highway bridge, so the highway is a
// real east-west route instead of a dead end at the riverbank.
export const RIVER = { x0: 3040, x1: 3360 };
export const BRIDGES = [800, 1760, HIGHWAY_Y]; // street centres that carry a bridge deck

export const PALETTE = {
  sand: '#e8c98f',
  sandDark: '#d9b878',
  grass: '#c9b06a',
  asphalt: '#3d3a38',
  asphaltLight: '#4a4642',
  sidewalk: '#cfc3a5',
  river: '#2fb3c9',
  riverDeep: '#1e8fa8',
  riverBank: '#e6d49a',
  stucco: '#f4ead2',
  terracotta: '#c96f3f',
  terracottaDark: '#a8542c',
  ochre: '#d9a441',
  white: '#fbf6e9',
  adobe: '#b98a5a',
  glass: '#7fd4e0',
  palm: '#3f7d3a',
  palmDark: '#2f6130',
  hud: '#fff3d6',
  accent: '#ffb03a',
  danger: '#ff4b3e',
  policeBlue: '#3a7bff',
  policeRed: '#ff3b30',
};

export const PLAYER = {
  radius: 16,
  walkSpeed: 210,
  sprintSpeed: 330,
  health: 100,
  punchDamage: 25,
  punchRange: 46,
  pistolDamage: 34,
  pistolRange: 520,
  // How close Sol must stand to a car to get in. A parked car reads as
  // "right there" from ~130 px away (its body is 46x84, so centre distance
  // runs long), so the old 70 px range left players mashing E at a car they
  // could clearly see. 150 px still cannot reach a car across a street, and
  // nearest-car wins when two are close.
  enterRange: 150,
  photoRange: 44,
};

export const CAR = {
  accel: 420,
  brake: 620,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.6,
  handbrake: 900,
  drag: 0.55,
  radius: 26,
  health: 100,
};

export const WANTED = {
  maxStars: 5,
  decayDelay: 12, // seconds with no crime and no police nearby before stars fall
  decayInterval: 8,
  crimeHeat: { steal: 1, assault: 1, shoot: 1, speeding: 0.4, kill: 2 },
  // Speeding only counts when a patrol car is close enough to see it.
  speedingSpeed: 400, // px/s (~128 km/h) and above
  speedingNearPolice: 600,
  speedingInterval: 2, // seconds between speeding heat ticks
  // Slipping a 3+ star chase clean pays out: the getaway is the job.
  cleanGetawayBonus: 200,
  cleanGetawayMinStars: 3,
};

export const MISSION_REWARDS = [300, 500, 800, 1000, 2000, 3000];

// Side activities.
export const SUN_DISC_REWARD = 50;
export const STUNT_REWARD = 150;
export const TAXI_REWARD = 120;
export const PHOTO_REWARD = 75;

export const SAVE_KEY = 'delrio-save-v1';
export const SHOT_SEED = 1;
