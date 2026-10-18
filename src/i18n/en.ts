// English: the UI's strings.
// `{{name}}` is filled in by the UI; `<tag>…</tag>` marks words the UI wraps (a key, a command).

export const en = {
  weekdays: {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  },
  places: {
    home: 'Home',
    cafe: 'Café',
    supermarket: 'Supermarket',
    'convenience-store': 'Convenience store',
    restaurant: 'Restaurant',
    clinic: 'Clinic',
    park: 'Park',
    'tram-stop': 'Tram stop',
    bookshop: 'Bookshop',
    bathhouse: 'Bathhouse',
    'town-office': 'Town office',
  },
  roles: {
    barista: {
      /** As a label: the chat header, the interaction prompt. */
      name: 'Barista',
      /** Starting a sentence. */
      subject: 'The barista',
    },
    landlord: {
      name: 'Landlord',
      subject: 'The landlord',
    },
    cashier: {
      name: 'Cashier',
      subject: 'The cashier',
    },
    clerk: {
      name: 'Clerk',
      subject: 'The clerk',
    },
    server: {
      name: 'Server',
      subject: 'The server',
    },
    receptionist: {
      name: 'Receptionist',
      subject: 'The receptionist',
    },
    doctor: {
      name: 'Doctor',
      subject: 'The doctor',
    },
    nurse: {
      name: 'Nurse',
      subject: 'The nurse',
    },
    pharmacist: {
      name: 'Pharmacist',
      subject: 'The pharmacist',
    },
    regular: {
      name: 'Park regular',
      subject: 'The regular',
    },
    'passer-by': {
      name: 'Passer-by',
      subject: 'The passer-by',
    },
    shopkeeper: {
      name: 'Shopkeeper',
      subject: 'The shopkeeper',
    },
    attendant: {
      name: 'Attendant',
      subject: 'The attendant',
    },
  },
  tramStops: {
    'west-stop': 'Old Town',
    'central-stop': 'Town Centre',
    'east-stop': 'Market Street',
  },
  dock: {
    label: 'Dock',
    time: 'Time',
    money: 'Money',
    day: 'Day {{day}} · {{weekday}}',
  },
  placeLine: {
    label: 'Place',
    hours: '{{opens}}–{{closes}}',
    allDay: 'Open 24 hours',
    closedOn: 'Closed: {{days}}',
    openNow: 'Open now',
    closedNow: 'Closed now',
  },
  gateway: {
    checking: 'Checking gateway…',
    reachable: 'Gateway reachable',
    reachableMock: 'Gateway reachable (mock mode)',
    unreachable: 'Gateway unreachable',
  },
  prompt: {
    talk: 'Press <kbd>E</kbd> to talk — {{role}}',
    tram: 'Press <kbd>E</kbd> to take the tram',
    noTram: 'No tram is running · Trams run {{opens}}–{{closes}}',
  },
  tram: {
    heading: 'Take the tram to…',
    trip: '{{minutes}} min · Free',
    cancel: 'Stay here',
  },
  faces: {
    relaxed: '{{who}} looks relaxed',
    puzzled: '{{who}} looks puzzled',
    strained: '{{who}} looks strained',
  },
  chat: {
    /** Over the NPC in the town, while a line of theirs is coming in. */
    speaking: 'speaking…',
    label: 'Conversation',
    log: 'Chat',
    leave: 'Leave',
    heardAs: 'Heard as',
    reconnecting: 'Reconnecting…',
    typedLabel: 'Typed reply',
    typedPlaceholder: 'Type a reply (T), Enter to send',
    mic: 'Hold to talk (Space)',
    micOff: '🎤 off',
    micOffHint: 'No mic, so you’re typing your replies',
  },
  closing: {
    label: 'Conversation over',
    success: 'Done!',
    notUnderstood: '{{who}} couldn’t understand you',
    noCharge: 'No charge',
  },
  toast: {
    npcSteppedAway: '{{who}} had to step away. Nothing was lost.',
  },
  voiceUnavailable: {
    title: 'Voice service unavailable: check the local server',
    body: 'The game couldn’t get a voice connection from the local server. Check that <code>npm run dev</code> is running and that <code>.env</code> has a Gemini API key, then try talking again.',
    back: 'Back to the game',
  },
};
