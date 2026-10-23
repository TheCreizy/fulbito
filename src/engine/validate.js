import * as common from './common.js'

export function validateTeam(team) {
  if (typeof team !== 'object') team = JSON.parse(team)
  if (!team.name) throw new Error('No team name given.')
  validateNumberOfPlayers(team.players)
  for (const player of team.players) {
    validatePlayerObjects(player)
  }
}

export function validateTeamSecondHalf(team) {
  if (typeof team !== 'object') team = JSON.parse(team)
  if (!team.name) throw new Error('No team name given.')
  if (!team.intent) throw new Error('No team intent given.')
  if (!team.teamID) throw new Error('No team ID given.')
  validateNumberOfPlayers(team.players)
  for (const player of team.players) {
    validatePlayerObjectsIteration(player)
  }
}

export function validateNumberOfPlayers(players) {
  if (!Array.isArray(players) || players.length !== 11) {
    throw new Error('There must be 11 players in a team')
  }
}

export function validatePlayerObjects(player) {
  const playerObjects = ['name', 'position', 'rating', 'currentPOS', 'injured', 'fitness', 'height']
  for (const obj of playerObjects) {
    if (!Object.prototype.hasOwnProperty.call(player, obj)) {
      throw new Error(`Player must contain JSON variable: ${obj}`)
    }
  }
  validatePlayerSkills(player.skill)
}

export function validatePlayerObjectsIteration(player) {
  if (player.playerID == null) {
    player.playerID = player.id || common.getRandomNumber(1000000000000, 99999999999999999)
  }
  if (!player.stats) {
    player.stats = {
      goals: 0,
      assists: 0,
      shots: { total: 0, on: 0, off: 0 },
      cards: { yellow: 0, red: 0 },
      passes: { total: 0, on: 0, off: 0 },
      crosses: { total: 0, on: 0 },
      dribbles: 0,
      blocks: 0,
      tackles: { total: 0, on: 0, off: 0, fouls: 0, slides: 0, standing: 0 },
      saves: 0,
      distanceCovered: 0
    }
  }
  if (!player.originPOS) {
    player.originPOS = Array.isArray(player.currentPOS) ? player.currentPOS.slice() : ['NP', 'NP']
  }
  if (!player.intentPOS) {
    player.intentPOS = player.originPOS.slice()
  }
  if (player.action == null) player.action = 'none'
  if (player.offside == null) player.offside = false
  if (player.hasBall == null) player.hasBall = false
  if (player.sentOff == null) player.sentOff = false

  const playerObjects = [
    'playerID', 'name', 'position', 'rating', 'currentPOS', 'injured', 'fitness', 'height',
    'originPOS', 'intentPOS', 'action', 'offside', 'hasBall', 'stats'
  ]
  for (const obj of playerObjects) {
    if (!Object.prototype.hasOwnProperty.call(player, obj)) {
      throw new Error(`Player must contain JSON variable: ${obj}`)
    }
  }
  validatePlayerSkills(player.skill)
  validateStats(player.stats)
}

export function validateStats(stats) {
  const statsObject = ['cards', 'goals', 'tackles', 'passes', 'shots']
  let badObjects = 0
  for (const type of statsObject) {
    if (!Object.prototype.hasOwnProperty.call(stats, type)) {
      badObjects++
    }
  }
  if (badObjects > 0) {
    throw new Error('Provide Stats: cards,goals,tackles,passes,shots')
  }
}

export function validatePlayerSkills(skills) {
  const skillType = ['passing', 'shooting', 'tackling', 'saving', 'agility', 'strength', 'penalty_taking', 'jumping']
  let badObjects = 0
  for (const type of skillType) {
    if (!Object.prototype.hasOwnProperty.call(skills, type)) {
      badObjects++
    }
  }
  if (badObjects > 0) {
    throw new Error('Provide skills: passing,shooting,tackling,saving,agility,strength,penalty_taking,jumping')
  }
  // Asegurar valores por defecto si perception, control, freekick, stamina o heading no vinieran definidos
  if (skills.perception === undefined) skills.perception = 70
  if (skills.control === undefined) skills.control = 70
  if (skills.freekick === undefined) skills.freekick = skills.shooting
  const defaultStamina = skills.stamina ?? skills.resistencia ?? 75
  skills.stamina = defaultStamina
  skills.resistencia = defaultStamina
  const defaultHeading = skills.heading ?? skills.cabeza ?? 70
  skills.heading = defaultHeading
  skills.cabeza = defaultHeading
}

export function validatePitch(pitchDetails) {
  const pitchObjects = ['pitchWidth', 'pitchHeight']
  let badObjects = 0
  for (const obj of pitchObjects) {
    if (!Object.prototype.hasOwnProperty.call(pitchDetails, obj)) {
      badObjects++
    }
  }
  if (badObjects > 0) {
    throw new Error('Please provide pitchWidth and pitchHeight')
  }
}

export function validateArguments(a, b, c) {
  if (a === undefined || b === undefined || c === undefined) {
    throw new Error('Please provide two teams and a pitch')
  }
}

export function validateMatchDetails(matchDetails) {
  const matchObjects = [
    'matchID', 'kickOffTeam', 'secondTeam', 'pitchSize', 'ball', 'half',
    'kickOffTeamStatistics', 'secondTeamStatistics', 'iterationLog'
  ]
  for (const obj of matchObjects) {
    if (!matchDetails || !Object.prototype.hasOwnProperty.call(matchDetails, obj)) {
      throw new Error('Please provide valid match details JSON')
    }
  }
  validateBall(matchDetails.ball)
}

export function validateBall(ball) {
  const ballProps = ['position', 'withPlayer', 'Player', 'withTeam', 'direction', 'ballOverIterations']
  for (const prop of ballProps) {
    if (!Object.prototype.hasOwnProperty.call(ball, prop)) {
      throw new Error('Provide: position,withPlayer,Player,withTeam,direction,ballOverIterations')
    }
  }
}

export function validatePlayerPositions(matchDetails) {
  const { kickOffTeam, secondTeam } = matchDetails
  const [pitchWidth, pitchHeight] = matchDetails.pitchSize
  for (const player of kickOffTeam.players) {
    if (common.isOnPitch(player)) {
      player.currentPOS[0] = common.upToMax(common.upToMin(player.currentPOS[0], 0), pitchWidth)
      player.currentPOS[1] = common.upToMax(common.upToMin(player.currentPOS[1], 0), pitchHeight)
    }
  }
  for (const player of secondTeam.players) {
    if (common.isOnPitch(player)) {
      player.currentPOS[0] = common.upToMax(common.upToMin(player.currentPOS[0], 0), pitchWidth)
      player.currentPOS[1] = common.upToMax(common.upToMin(player.currentPOS[1], 0), pitchHeight)
    }
  }
}
