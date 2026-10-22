// Motor de Relatos y Comentarios Estilo Marcelo Araujo y Enrique Macaya Márquez
// Intercepta los logs e información contextual del motor en cada iteración.

const PLAYER_NICKNAMES = {
  'Diego Maradona': ['el Diez', 'Diego Armando', 'Pelusa', 'el Genio del Fútbol Mundial'],
  'Lionel Messi': ['la Pulga', 'Leo Messi', 'el Messías', 'el rosarino'],
  'Pelé': ['O Rei Pelé', 'la Perla Negra'],
  'Ronaldo Nazário': ['el Fenómeno Ronaldo', 'el Gordo Ronaldo'],
  'Juan Román Riquelme': ['Román', 'el Torero Riquelme', 'el Último Diez'],
  'Johan Cruyff': ['el Flaco Cruyff', 'el holandés volador'],
  'Zinedine Zidane': ['Zizou', 'el Mago Zidane'],
  'Cristiano Ronaldo': ['el Bicho', 'Cristiano'],
  'Ronaldinho': ['Dinho', 'la sonrisa del fútbol'],
  'Franz Beckenbauer': ['el Káiser Beckenbauer'],
  'Paolo Maldini': ['Il Capitano Maldini'],
  'Roberto Carlos': ['el Hombre Bala Roberto Carlos'],
  'Gabriel Batistuta': ['el Bati', 'Batigol', 'el Facha Batistuta'],
  'Daniel Passarella': ['el Káiser Passarella', 'el Gran Capitán'],
  'Martín Palermo': ['el Titán Palermo', 'el Loco Palermo', 'el Optimista del Gol'],
  'Carlos Tevez': ['Carlitos', 'el Apache Tevez'],
  'Ángel Di María': ['Angelito', 'el Fideo Di María'],
  'Ariel Ortega': ['el Burrito Ortega', 'el jujeño'],
  'Enzo Francescoli': ['el Príncipe Francescoli', 'el uruguayo'],
  'Oscar Córdoba': ['el colombiano Córdoba'],
  'R. Abbondanzieri': ['el Pato Abbondanzieri'],
  'Emiliano Martínez': ['el Dibu Martínez'],
  'Walter Samuel': ['el Muro Samuel'],
  'Roberto Ayala': ['el Ratón Ayala'],
  'Jorge Bermúdez': ['el Patrón Bermúdez'],
  'Hugo Ibarra': ['el Negro Ibarra'],
  'Javier Zanetti': ['el Pupi Zanetti'],
  'Juan Pablo Sorín': ['Juampi Sorín'],
  'Fernando Redondo': ['el Príncipe Redondo'],
  'Diego Simeone': ['el Cholo Simeone'],
  'Sebastián Battaglia': ['Seba Battaglia'],
  'Juan S. Verón': ['la Brujita Verón'],
  'Pablo Aimar': ['el Payaso Aimar', 'Pablito Aimar'],
  'G. Barros Schelotto': ['el Mellizo Guillermo', 'Chapita'],
  'Claudio Caniggia': ['el Pájaro Caniggia', 'el Hijo del Viento'],
  'Hernán Crespo': ['Valdanito Crespo'],
  'Sergio Agüero': ['el Kun Agüero'],
  'Mauricio Serna': ['Chicho Serna'],
  'Blas Giunta': ['Blas Armando Giunta'],
  'Rolando Schiavi': ['el Flaco Schiavi'],
  'Cata Díaz': ['el Cata Díaz'],
  'Fernando Gago': ['Pintita Gago'],
  'Leonardo Ponzio': ['el León Ponzio'],
  'Rodrigo Palacio': ['la Joya Palacio'],
  'Marcelo Delgado': ['el Chelo Delgado'],
  'Darío Benedetto': ['el Pipa Benedetto'],
  'Lucas Pratto': ['el Oso Pratto'],
  'Chiqui Pérez': ['el Chiqui Pérez'],
  'Naohiro Takahara': ['el japonés Takahara'],
  'Franco Soldano': ['el incansable Soldano'],
  'Emmanuel Gigliotti': ['el Puma Gigliotti'],

  // Nuevas Leyendas (101-120)
  'Alfredo Di Stéfano': ['la Saeta Rubia', 'don Alfredo'],
  'Garrincha': ['Mané Garrincha', 'la Alegría del Pueblo', 'el Ángel de las Piernas Torcidas'],
  'Franco Baresi': ['Capitano Baresi', 'il Grande Franco'],
  'Michel Platini': ['le Roi Michel', 'Platini'],
  'Marco van Basten': ['el Cisne de Utrecht', 'Van Basten'],
  'Romário': ['O Baixinho', 'Romário de Souza'],
  'Roberto Baggio': ['il Divin Codino', 'Roby Baggio'],
  'Ronald Koeman': ['Tintín Koeman', 'el bombardero de Zaandam'],
  'Thierry Henry': ['Tití Henry', 'el rey de Highbury'],
  'Andrea Pirlo': ['il Maestro Pirlo', 'el Arquitecto'],
  'Luka Modrić': ['el mago de Zadar', 'Lukita Modrić'],
  'Toni Kroos': ['el Francotirador Kroos', 'el reloj alemán'],
  'Dani Alves': ['Dani Alves', 'el tren de Bahía'],
  'Marcelo': ['Marcelo', 'el crack carioca'],
  'Alessandro Nesta': ['Sandro Nesta', 'el muro italiano'],
  'Carles Puyol': ['Tarzán Puyol', 'el Tiburón Puyol', 'el Capitán eterno'],
  'Manuel Neuer': ['Manu Neuer', 'el arquero-líbero'],
  'Iker Casillas': ['San Iker', 'el Santo de Móstoles'],
  'Mario Kempes': ['el Matador Kempes', 'el héroe del 78'],
  'Ricardo Bochini': ['el Bocha Bochini', 'el Maestro Bochini'],

  // Nuevos Ídolos (121-145)
  'Ángel Clemente Rojas': ['Rojitas', 'la cintura mágica'],
  'Rubén Suñé': ['el Chapa Suñé'],
  'Roberto Mouzo': ['el gran Mouzo'],
  'Antonio Rattín': ['el Rata Rattín', 'el caudillo'],
  'Alberto Márcico': ['el Beto Márcico'],
  'Sergio Martínez': ['el Manteca Martínez'],
  'Silvio Marzolini': ['Silvio Marzolini', 'el mejor tres de la historia'],
  'Hugo Gatti': ['el Loco Gatti'],
  'Ubaldo Fillol': ['el Pato Fillol', 'el invencible Fillol'],
  'José Luis Chilavert': ['Chila', 'el León de Guaraní', 'José Luis Félix'],
  'Oscar Ruggeri': ['el Cabezón Ruggeri'],
  'Gabriel Heinze': ['el Gringo Heinze'],
  'Javier Mascherano': ['el Jefecito Mascherano'],
  'Esteban Cambiasso': ['el Cuchu Cambiasso'],
  'Lucho González': ['el Comandante Lucho'],
  'Andrés D\'Alessandro': ['el Cabezón D\'Alessandro', 'el Mago de la Boba'],
  'Leandro Romagnoli': ['el Pipi Romagnoli'],
  'Diego Milito': ['el Príncipe Milito'],
  'Lisandro López': ['Licha López'],
  'Claudio López': ['el Piojo López'],
  'Ezequiel Lavezzi': ['el Pocho Lavezzi'],
  'Fernando Cavenaghi': ['el Torito Cavenaghi'],
  'Diego Forlán': ['Cachavacha Forlán'],
  'Enzo Pérez': ['Enzo Pérez', 'el alma del equipo'],
  'Carlos Bianchi': ['el Virrey Bianchi', 'el goleador insaciable'],

  // Nuevos Plantilla y Relleno Destacados
  'Luis Islas': ['el Loco Islas'],
  'Sebastián Saja': ['el Chino Saja'],
  'Mauricio Caranta': ['Mauricio Caranta'],
  'Germán Lux': ['Poroto Lux'],
  'Néstor Fabbri': ['la Tota Fabbri'],
  'Aníbal Matellán': ['Aníbal Matellán'],
  'Juan Manuel Insaurralde': ['el Chaco Insaurralde'],
  'Carlos Izquierdoz': ['el Cali Izquierdoz'],
  'Javier Pinola': ['Javier Pinola'],
  'Leonel Vangioni': ['el Piri Vangioni'],
  'Frank Fabra': ['Frank Fabra'],
  'Iván Pillud': ['Iván Pillud'],
  'Julio Buffarini': ['Buffa', 'Julio Buffarini'],
  'Marcelo Weigandt': ['el Chelo Weigandt'],
  'Iván Marcone': ['el Capo Marcone'],
  'Andrés Cubas': ['Cubitas'],
  'Leandro Somoza': ['Leandro Somoza'],
  'Pablo Ledesma': ['Pablo Ledesma'],
  'Pablo Guiñazú': ['el Cholo Guiñazú'],
  'Ignacio Fernández': ['Nacho Fernández'],
  'Maxi Moralez': ['Frasquito Moralez'],
  'Ricardo Centurión': ['Ricky Centurión'],
  'Nicolás Bertolo': ['Nico Bertolo'],
  'Cristian Pavón': ['Kichán Pavón'],
  'Rodrigo Mora': ['la fiera Mora', 'el uruguayo Mora'],
  'Ignacio Scocco': ['Nacho Scocco'],
  'Ramón Ábila': ['Wanchope Ábila'],
  'Nicolás Blandi': ['Nico Blandi'],
  'Fernando Gamboa': ['el Negro Gamboa'],
  'Cristian Lucchetti': ['el Laucha Lucchetti'],
  'Juan Krupoviesa': ['el Tucumano Krupoviesa'],
  'Marcelo Meli': ['Cesarini Meli'],
  'Federico Carrizo': ['el Pachi Carrizo'],
  'Pablo Mouche': ['Pablito Mouche'],
  'Andrés Chávez': ['el Comandante Chávez'],
  'Lucas Viatri': ['Lucas Viatri'],
  'Lucas Boyé': ['el Tanque Boyé'],
  'Jan Hurtado': ['el venezolano Hurtado'],
  'Lucas Castromán': ['Lucas Castromán']
}

export function getPlayerNickname(playerName) {
  const aliases = PLAYER_NICKNAMES[playerName]
  return aliases && aliases.length > 0 ? aliases[0] : ''
}

function getAlias(playerName) {
  const aliases = PLAYER_NICKNAMES[playerName]
  if (aliases && Math.random() < 0.65) {
    return aliases[Math.floor(Math.random() * aliases.length)]
  }
  return playerName
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Procesa una iteración del partido y devuelve un array de mensajes de relato
 * (vacío si en ese tick no ocurrió nada digno de mención o si está en cooldown).
 */
export function generateCommentaryForIteration(matchDetails, prevScore, minuteFormatted, stateTracker) {
  const messages = []
  const logs = matchDetails.iterationLog || []
  const { kickOffTeam, secondTeam } = matchDetails

  const findPlayerObj = (name) => {
    return (
      kickOffTeam.players.find(p => p.name === name) ||
      secondTeam.players.find(p => p.name === name) ||
      null
    )
  }

  for (const line of logs) {
    // 1. GOL CONVERTIDO
    if (line.startsWith('Goal Scored by - ')) {
      const parts = line.replace('Goal Scored by - ', '').split(' - ')
      const scorerName = parts[0]?.trim() || 'el delantero'
      const teamName = (parts[1] || '').replace(/[()]/g, '').trim()
      const alias = getAlias(scorerName)
      const koGoals = matchDetails.kickOffTeamStatistics.goals
      const stGoals = matchDetails.secondTeamStatistics.goals

      messages.push({
        id: `${Date.now()}-${Math.random()}`,
        minute: minuteFormatted,
        speaker: 'Marcelo Araujo',
        type: 'goal',
        text: pickRandom([
          `¡GOOOOOOL! ¡Sí, sí, sí! ¡De ${teamName}! ¡${alias}, ${alias}, ${alias}! ¡Cantalo, cantalo, cantalo!`,
          `¡GOOOOOOL! ¡Fierrazo letal de ${alias} para ${teamName}! ¡Una barbaridad, Macaya, qué digo gol: qué golazo!`,
          `¡Adentroooo! ¡GOOOOL de ${teamName}! Lo hizo ${alias}. Ahora están ${kickOffTeam.name} ${koGoals} - ${secondTeam.name} ${stGoals}.`
        ])
      })
      messages.push({
        id: `${Date.now()}-${Math.random()}-m`,
        minute: minuteFormatted,
        speaker: 'Enrique Macaya Márquez',
        type: 'analysis',
        text: pickRandom([
          `Fue toda la jerarquía individual de ${scorerName}. Cuando le dejás medio metro en zona de definición, no te perdona.`,
          `Desajuste defensivo en el retroceso y una definición impecable de ${scorerName}. Justo premio para ${teamName}.`,
          `La jugada pedía resolución rápida y ${scorerName} eligió el lugar exacto donde el arquero no podía llegar.`
        ])
      })
      stateTracker.lastCommentTick = matchDetails.iterationCount
      return messages
    }

    // 2. TARJETA ROJA
    if (line.startsWith('Red Card - ')) {
      const raw = line.replace('Red Card - ', '')
      messages.push({
        id: `${Date.now()}-${Math.random()}`,
        minute: minuteFormatted,
        speaker: 'Marcelo Araujo',
        type: 'redCard',
        text: `¡ROJA! ¡A las duchas ${raw}! ¡Se volvió loco, señor juez! Se queda con uno menos.`
      })
      messages.push({
        id: `${Date.now()}-${Math.random()}-m`,
        minute: minuteFormatted,
        speaker: 'Enrique Macaya Márquez',
        type: 'analysis',
        text: `Irresponsabilidad total. Llegó muy a destiempo y ahora obliga a su técnico a rearmar todo el dibujo táctico.`
      })
      stateTracker.lastCommentTick = matchDetails.iterationCount
      return messages
    }

    // 3. TARJETA AMARILLA
    if (line.startsWith('Yellow Card - ')) {
      const raw = line.replace('Yellow Card - ', '')
      messages.push({
        id: `${Date.now()}-${Math.random()}`,
        minute: minuteFormatted,
        speaker: 'Marcelo Araujo',
        type: 'yellowCard',
        text: `¡Amarilla para ${raw}! ¡Lo taló abajo, estaba para algo más que amarilla, eh!`
      })
      stateTracker.lastCommentTick = matchDetails.iterationCount
      return messages
    }

    // 4. CAMBIO / SUSTITUCIÓN
    if (line.startsWith('Substitution (')) {
      const match = line.match(/Substitution \((.+)\): (.+) IN for (.+)/)
      if (match) {
        const [, tName, pIn, pOut] = match
        messages.push({
          id: `${Date.now()}-${Math.random()}`,
          minute: minuteFormatted,
          speaker: 'Enrique Macaya Márquez',
          type: 'sub',
          text: `Mueve el banco ${tName}: ingresa piernas frescas con ${pIn} y se retira agotado ${pOut}.`
        })
        stateTracker.lastCommentTick = matchDetails.iterationCount
        return messages
      }
    }

    // 5. PENAL COBRADO
    if (line.startsWith('penalty to: ')) {
      const tName = line.replace('penalty to: ', '').trim()
      messages.push({
        id: `${Date.now()}-${Math.random()}`,
        minute: minuteFormatted,
        speaker: 'Marcelo Araujo',
        type: 'penalty',
        text: `¡PENAAAAAL! ¡Penal, penal, penal para ${tName}! ¡No lo dude, señor juez, lo camiseteó adentro del área!`
      })
      stateTracker.lastCommentTick = matchDetails.iterationCount
      return messages
    }

    // 6. TIRO LIBRE PELIGROSO / REMATE DE TIRO LIBRE
    if (line.startsWith('Direct Freekick Shot by: ')) {
      const pName = line.replace('Direct Freekick Shot by: ', '').trim()
      const alias = getAlias(pName)
      messages.push({
        id: `${Date.now()}-${Math.random()}`,
        minute: minuteFormatted,
        speaker: 'Marcelo Araujo',
        type: 'freekick',
        text: `¡Atento Macaya! ¡Se perfila ${alias} en el tiro libre! ¡Si pasa la barrera es medio gol!`
      })
      stateTracker.lastCommentTick = matchDetails.iterationCount
      return messages
    }

    // 7. ATAJADA DEL ARQUERO (Córner, Rebote o Embolsada)
    if (
      line.startsWith('ball saved by ') ||
      line.startsWith('Ball saved by ') ||
      line.startsWith('Magnificent save by ') ||
      line.startsWith('Sensational goal-line save by ') ||
      line.startsWith('Save by ') ||
      line.startsWith('Ball saved on the line by ')
    ) {
      const isCornerSave = line.includes('corner') || line.includes('tipped out')
      const isReboundSave = line.includes('spills') || line.includes('rebounds')
      let gkName = 'el arquero'
      const mGk = line.match(/(?:by|de)\s+([A-Za-zÁ-ÿ\s]+?)(?:!|\s+possesion|\s+Team|$)/)
      if (mGk) gkName = mGk[1].trim()
      const alias = getAlias(gkName)

      if (isCornerSave) {
        messages.push({
          id: `${Date.now()}-${Math.random()}`,
          minute: minuteFormatted,
          speaker: 'Marcelo Araujo',
          type: 'save',
          text: pickRandom([
            `¡¡LA MANDÓ AL CÓRNER ${alias.toUpperCase()}!! ¡Qué tapada monumental por arriba del travesaño, Macaya!`,
            `¡Sensacional intervención de ${alias}! Se estiró cuan largo es y la desvió al tiro de esquina. ¡Monumental!`,
            `¡Uhhhhhh! ¡Manotazo salvador de ${alias} contra el palo y al córner! ¡Cantalo, cantalo... todavía no!`
          ])
        })
      } else if (isReboundSave) {
        messages.push({
          id: `${Date.now()}-${Math.random()}`,
          minute: minuteFormatted,
          speaker: 'Marcelo Araujo',
          type: 'save',
          text: pickRandom([
            `¡Rebotó ${alias}! ¡Quedó la pelota viva y suelta en el corazón del área, peligro total!`,
            `¡Tapó ${alias} a quemarropa pero dio rebote! ¡Alerta máxima en el área chica!`,
            `¡Le quemó las manos el disparo a ${alias}! Rebote caliente en la medialuna...`
          ])
        })
      } else {
        messages.push({
          id: `${Date.now()}-${Math.random()}`,
          minute: minuteFormatted,
          speaker: 'Marcelo Araujo',
          type: 'save',
          text: pickRandom([
            `¡ATAJÓ ${alias.toUpperCase()}! ¡Tremendo manotazo salvador cuando ya lo gritaban!`,
            `¡Gigante ${alias} abajo de los tres palos! Se quedó con una pelota imposible, Macaya.`,
            `¡Nooooo! ¡Lo que acaba de embolsar ${alias}, por favor! Seguridad absoluta bajo el arco.`
          ])
        })
      }
      stateTracker.lastCommentTick = matchDetails.iterationCount
      return messages
    }

    // 8. TIRO AFUERA
    if (line.startsWith('Shot Off Target') || line.startsWith('Freekick Shot Off Target')) {
      const shooterName = matchDetails.ball.lastTouch?.playerName || 'el atacante'
      const shooterObj = findPlayerObj(shooterName)
      const alias = getAlias(shooterName)
      if (shooterObj?.category === 'filler') {
        messages.push({
          id: `${Date.now()}-${Math.random()}`,
          minute: minuteFormatted,
          speaker: 'Enrique Macaya Márquez',
          type: 'miss',
          text: `Y... se notó la limitación técnica de ${shooterName}. Le mordió de lleno a la pelota y se fue muy lejos.`
        })
      } else {
        messages.push({
          id: `${Date.now()}-${Math.random()}`,
          minute: minuteFormatted,
          speaker: 'Marcelo Araujo',
          type: 'miss',
          text: pickRandom([
            `¡Uhhhhhh! ¡Se lo perdió ${alias}! ¡Cantalo, cantalo... NO! ¡Afuera, Macaya, besó el palo!`,
            `¡Afueraaaa! Le entró muy abajo ${alias}, se apuró en la definición.`,
            `¡Probó de media distancia ${alias} y la pelota pasó silbando el travesaño!`
          ])
        })
      }
      stateTracker.lastCommentTick = matchDetails.iterationCount
      return messages
    }

    // 9. LESIÓN (Knock, Hurt o Serious)
    if (line.startsWith('Player Injured')) {
      let grade = 'knock'
      let pName = 'el jugador'
      let detail = ''
      if (line.includes('[KNOCK]')) {
        grade = 'knock'
        const match = line.match(/\[KNOCK\] - ([^:]+): (.+)/)
        if (match) { pName = match[1].trim(); detail = match[2].trim() }
      } else if (line.includes('[HURT]')) {
        grade = 'hurt'
        const match = line.match(/\[HURT\] - ([^:]+): (.+)/)
        if (match) { pName = match[1].trim(); detail = match[2].trim() }
      } else if (line.includes('[SERIOUS]')) {
        grade = 'serious'
        const match = line.match(/\[SERIOUS\] - ([^:]+): (.+)/)
        if (match) { pName = match[1].trim(); detail = match[2].trim() }
      } else {
        pName = line.replace('Player Injured - ', '').trim()
      }

      let injuryText = ''
      if (grade === 'serious') {
        injuryText = `¡Atención Marcelo, no va más ${pName}! Se tira al piso con claros gestos de dolor (${detail}). Piden el cambio de urgencia desde el banco.`
      } else if (grade === 'hurt') {
        injuryText = `Ojo Marcelo, está rengueando ${pName} tras una molestia física (${detail}). Va a seguir en cancha pero visiblemente disminuido.`
      } else {
        injuryText = `Fue un susto, Marcelo. ${pName} recibió un golpe (${detail}), pero tras la atención médica se reincorpora al juego.`
      }

      messages.push({
        id: `${Date.now()}-${Math.random()}`,
        minute: minuteFormatted,
        speaker: 'Enrique Macaya Márquez',
        type: 'injury',
        grade,
        text: injuryText
      })
      stateTracker.lastCommentTick = matchDetails.iterationCount
      return messages
    }
  }

  // Comentarios de ambiente/juego con cooldown amplio (cada ~52 iteraciones) para evitar saturación
  const ticksSinceLast = (matchDetails.iterationCount || 0) - (stateTracker.lastCommentTick || 0)
  if (ticksSinceLast < 52) return messages

  for (const line of logs) {
    if (line.startsWith('Gambeta by: ')) {
      const raw = line.replace('Gambeta by: ', '')
      const [dribbler, defender] = raw.split(' past ')
      const alias = getAlias((dribbler || '').trim())
      messages.push({
        id: `${Date.now()}-${Math.random()}`,
        minute: minuteFormatted,
        speaker: 'Marcelo Araujo',
        type: 'play',
        text: pickRandom([
          `¡Qué gambeta de ${alias}! ¡Lo dejó pagando a ${defender || 'su marcador'} y encara con campo abierto!`,
          `¡Atento Macaya que frotó la lámpara ${alias}! ¡Cintura, amague y a cobrar ${defender || 'el defensor'}!`,
          `¡Limpió el camino ${alias} en el mano a mano! Cuando arranca en velocidad es imparable.`
        ])
      })
      stateTracker.lastCommentTick = matchDetails.iterationCount
      return messages
    }

    if (line.startsWith('Caudillo body check by: ') || line.startsWith('Caudillo tackle by: ')) {
      const raw = line.replace('Caudillo body check by: ', '').replace('Caudillo tackle by: ', '')
      const [caudillo, victim] = raw.includes(' against ') ? raw.split(' against ') : raw.split(' on ')
      const alias = getAlias((caudillo || '').trim())
      messages.push({
        id: `${Date.now()}-${Math.random()}`,
        minute: minuteFormatted,
        speaker: 'Marcelo Araujo',
        type: 'play',
        text: pickRandom([
          `¡Cuerpeó con todo ${alias} y lo desparramó a ${victim || 'su rival'}! ¡Impecable carga hombro a hombro!`,
          `¡Qué caudillo es ${alias}! Puso el lomo con una fuerza colosal y le extirpó la pelota sin falta.`,
          `¡A lo guapo ${alias}! Le tiró la carrocería encima a ${victim || 'su adversario'} y se queda con la posesión.`
        ])
      })
      stateTracker.lastCommentTick = matchDetails.iterationCount
      return messages
    }

    if (line.includes('Explosive sprint shot by: ')) {
      const shooter = line.replace('Explosive sprint shot by: ', '').replace(' (Power boosted)', '').trim()
      const alias = getAlias(shooter)
      messages.push({
        id: `${Date.now()}-${Math.random()}`,
        minute: minuteFormatted,
        speaker: 'Marcelo Araujo',
        type: 'shot',
        text: pickRandom([
          `¡Sacó un misil a la carrera ${alias}! ¡Qué violencia en el disparo en plena velocidad!`,
          `¡Bombazo en carrera de ${alias}! Aprovechó toda la inercia del sprint y reventó el arco.`
        ])
      })
      stateTracker.lastCommentTick = matchDetails.iterationCount
      return messages
    }

    if (line.startsWith('Foul against: ')) {
      const raw = line.replace('Foul against: ', '')
      const [victim, offender] = raw.split(' by ')
      messages.push({
        id: `${Date.now()}-${Math.random()}`,
        minute: minuteFormatted,
        speaker: 'Marcelo Araujo',
        type: 'foul',
        text: `¡Falta! Infracción de ${offender || 'el marcador'} abajo sobre ${victim || 'el volante'}. Tiro libre.`
      })
      stateTracker.lastCommentTick = matchDetails.iterationCount
      return messages
    }

    if (line.startsWith('Successful tackle by: ')) {
      const tackler = line.replace('Successful tackle by: ', '').trim()
      const alias = getAlias(tackler)
      messages.push({
        id: `${Date.now()}-${Math.random()}`,
        minute: minuteFormatted,
        speaker: 'Marcelo Araujo',
        type: 'play',
        text: `¡Qué cruce fenomenal de ${alias}! Limpito abajo para trabar y ganar la dividida.`
      })
      stateTracker.lastCommentTick = matchDetails.iterationCount
      return messages
    }

    if (line.startsWith('One-two wall pass by: ')) {
      const raw = line.replace('One-two wall pass by: ', '')
      const [p1, p2] = raw.split(' with ')
      const a1 = getAlias((p1 || '').trim())
      const a2 = getAlias((p2 || '').trim())
      messages.push({
        id: `${Date.now()}-${Math.random()}`,
        minute: minuteFormatted,
        speaker: 'Marcelo Araujo',
        type: 'play',
        text: pickRandom([
          `¡Qué pared armaron ${a1} y ${a2}! ¡Devolución de primera al espacio y rompieron la defensa!`,
          `¡Tocaron y fueron a buscar! Magistral pared entre ${a1} y ${a2}, fútbol de alto vuelo.`,
          `¡Viva el fútbol, Macaya! Qué triangulación limpia entre ${a1} y ${a2} para romper líneas.`
        ])
      })
      stateTracker.lastCommentTick = matchDetails.iterationCount
      return messages
    }

    if (line.startsWith('through ball attempted by: ')) {
      const passer = line.replace('through ball attempted by: ', '').trim()
      const pObj = findPlayerObj(passer)
      const alias = getAlias(passer)
      if (pObj && (pObj.category === 'legend' || pObj.category === 'idol')) {
        messages.push({
          id: `${Date.now()}-${Math.random()}`,
          minute: minuteFormatted,
          speaker: 'Marcelo Araujo',
          type: 'play',
          text: `¡Atento que la tiene el distinto! ¡Pelota filtrada de ${alias} cortando líneas como con un bisturí!`
        })
        stateTracker.lastCommentTick = matchDetails.iterationCount
        return messages
      }
    }

    if (line.startsWith('ball crossed by: ')) {
      const crosser = line.replace('ball crossed by: ', '').trim()
      const alias = getAlias(crosser)
      messages.push({
        id: `${Date.now()}-${Math.random()}`,
        minute: minuteFormatted,
        speaker: 'Marcelo Araujo',
        type: 'play',
        text: pickRandom([
          `¡Desbordó hasta el fondo ${alias} y manda el centro venenoso al corazón del área!`,
          `¡Atento en el área! ¡Centro pasado de ${alias} buscando una cabeza salvadora!`
        ])
      })
      stateTracker.lastCommentTick = matchDetails.iterationCount
      return messages
    }

    if (line.includes('is offside')) {
      const offPlayer = line.split(' is offside')[0].trim()
      messages.push({
        id: `${Date.now()}-${Math.random()}`,
        minute: minuteFormatted,
        speaker: 'Enrique Macaya Márquez',
        type: 'offside',
        text: `Levantó la bandera el línea: estaba medio paso adelantado ${offPlayer} cuando salió el pase.`
      })
      stateTracker.lastCommentTick = matchDetails.iterationCount
      return messages
    }

    if (line.startsWith('Goalkeeper long clearance by: ')) {
      const gkName = line.replace('Goalkeeper long clearance by: ', '').trim()
      const alias = getAlias(gkName)
      messages.push({
        id: `${Date.now()}-${Math.random()}`,
        minute: minuteFormatted,
        speaker: 'Marcelo Araujo',
        type: 'play',
        text: pickRandom([
          `¡${alias} despeja con un zapatazo largo buscando a los delanteros!`,
          `¡Pelotazo largo del arquero ${alias} para salir del asedio rival!`,
          `¡La revienta hacia adelante ${alias}! Salida limpia para el contragolpe.`
        ])
      })
      stateTracker.lastCommentTick = matchDetails.iterationCount
      return messages
    }

    if (line.startsWith('Corner to - ')) {
      const tName = line.replace('Corner to - ', '').trim()
      messages.push({
        id: `${Date.now()}-${Math.random()}`,
        minute: minuteFormatted,
        speaker: 'Marcelo Araujo',
        type: 'corner',
        text: `¡Tiro de esquina! Suben los grandotes al área para buscar el cabezazo en ${tName}.`
      })
      stateTracker.lastCommentTick = matchDetails.iterationCount
      return messages
    }
  }

  // Si pasaron más de 105 ticks sin eventos destacados, Macaya analiza la posesión o el cansancio
  if (ticksSinceLast >= 105) {
    const koTicks = matchDetails.kickOffTeamStatistics.possessionTicks || 1
    const stTicks = matchDetails.secondTeamStatistics.possessionTicks || 1
    const koPoss = Math.round((koTicks / (koTicks + stTicks)) * 100)
    const dominantTeam = koPoss >= 55 ? kickOffTeam : (koPoss <= 45 ? secondTeam : null)

    if (dominantTeam) {
      messages.push({
        id: `${Date.now()}-${Math.random()}`,
        minute: minuteFormatted,
        speaker: 'Enrique Macaya Márquez',
        type: 'analysis',
        text: `${dominantTeam.name} maneja los tiempos y el ancho de la cancha con una tenencia clara del balón, Marcelo.`
      })
    } else {
      const ballCarrier = findPlayerObj(matchDetails.ball.lastTouch?.playerName)
      if (ballCarrier && ballCarrier.category === 'legend') {
        messages.push({
          id: `${Date.now()}-${Math.random()}`,
          minute: minuteFormatted,
          speaker: 'Marcelo Araujo',
          type: 'play',
          text: `La pide ${getAlias(ballCarrier.name)} en tres cuartos de cancha... cuando la toca él, pasa algo distinto.`
        })
      } else {
        messages.push({
          id: `${Date.now()}-${Math.random()}`,
          minute: minuteFormatted,
          speaker: 'Enrique Macaya Márquez',
          type: 'analysis',
          text: `Partido muy disputado en la zona media. Buscan abrir por las bandas para romper el bloque defensivo.`
        })
      }
    }
    stateTracker.lastCommentTick = matchDetails.iterationCount
  }

  return messages
}

export function generatePenaltyShootoutComment(kicker, goalie, outcome, teamName) {
  const kAlias = getAlias(kicker?.name || 'el ejecutante')
  const gAlias = getAlias(goalie?.name || 'el arquero')

  if (outcome === 'goal') {
    return {
      speaker: 'Marcelo Araujo',
      text: pickRandom([
        `¡GOOOOL de ${teamName}! ¡Fuerte y adentro ${kAlias}, nada que hacer para ${gAlias}!`,
        `¡Adentrooo! ¡Con qué categoría la cruzó ${kAlias} para poner arriba a ${teamName}!`,
        `¡Golazo de penal de ${kAlias}! Engañó por completo a ${gAlias}.`
      ])
    }
  }
  if (outcome === 'saved') {
    return {
      speaker: 'Marcelo Araujo',
      text: pickRandom([
        `¡ATAJÓ ${gAlias.toUpperCase()}! ¡Gigante, inmenso ${gAlias} volando contra el palo para ahogarle el grito a ${kAlias}!`,
        `¡Lo atajó, lo atajó! ¡Adivinó la punta ${gAlias} y se queda con el penal de ${kAlias}!`
      ])
    }
  }
  return {
    speaker: 'Enrique Macaya Márquez',
    text: pickRandom([
      `¡Afuera! Le entró muy de abajo ${kAlias} y la pelota se fue por arriba del travesaño.`,
      `¡Desviado! Quiso asegurar el ángulo ${kAlias} y la tiró ancha junto al palo.`
    ])
  }
}

